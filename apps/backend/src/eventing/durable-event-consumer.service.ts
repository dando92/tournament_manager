import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EventEnvelope,
  LiveEventEnvelope,
  TournamentCreatedEvent,
  TournamentCreatedPayload,
} from '../contracts/events';
import {
  DURABLE_EVENT_TRANSPORT,
  DurableEventMessage,
  DurableEventTransport,
  LIVE_EVENT_TRANSPORT,
  LiveEventTransport,
} from './eventing.interfaces';
import { PostgresEventConsumerPersistence } from './postgres-event-consumer.persistence';
import { DurableEventHandlerRegistry } from './durable-event-handler.registry';

@Injectable()
export class DurableEventConsumerService {
  static readonly consumerIdentity = 'tournament-created-projection';
  static readonly maximumAttempts = 3;
  private readonly logger = new Logger(DurableEventConsumerService.name);

  constructor(
    private readonly persistence: PostgresEventConsumerPersistence,
    private readonly config: ConfigService,
    @Inject(DURABLE_EVENT_TRANSPORT)
    private readonly durableTransport: DurableEventTransport,
    @Inject(LIVE_EVENT_TRANSPORT)
    private readonly liveTransport: LiveEventTransport,
    private readonly handlers: DurableEventHandlerRegistry,
  ) {}

  ensureGroup(): Promise<void> {
    return this.durableTransport.ensureConsumerGroup(this.stream, this.group);
  }

  async consumeOnce(
    consumer: string,
    blockMilliseconds = this.consumerBlockMilliseconds,
  ): Promise<number> {
    const pending = await this.durableTransport.claimStale(
      this.stream,
      this.group,
      consumer,
      this.reclaimIdleMilliseconds,
      10,
    );
    const messages = pending.length
      ? pending
      : await this.durableTransport.read(
          this.stream,
          this.group,
          consumer,
          10,
          blockMilliseconds,
        );
    for (const message of messages) await this.process(message);
    return messages.length;
  }

  private async process(message: DurableEventMessage): Promise<void> {
    try {
      const handled = await this.handleIdempotently(message.event);
      if (handled) await this.publishLiveUpdate(message.event);
      await this.durableTransport.acknowledge(
        this.stream,
        this.group,
        message.streamId,
      );
      await this.durableTransport.clearAttempt(this.group, message.event.id);
    } catch (error) {
      const attempts = await this.durableTransport.incrementAttempt(
        this.group,
        message.event.id,
        message.event.aggregateId,
      );
      const reason = error instanceof Error ? error.message : String(error);
      if (attempts >= DurableEventConsumerService.maximumAttempts) {
        await this.durableTransport.deadLetter(
          this.stream,
          message.event,
          reason,
          attempts,
        );
        await this.durableTransport.acknowledge(
          this.stream,
          this.group,
          message.streamId,
        );
        await this.durableTransport.clearAttempt(this.group, message.event.id);
        this.logger.error(
          `Dead-lettered event ${message.event.id} after ${attempts} attempts: ${reason}`,
        );
      } else {
        this.logger.warn(
          `Event ${message.event.id} failed attempt ${attempts}: ${reason}`,
        );
      }
    }
  }

  private handleIdempotently(event: EventEnvelope): Promise<boolean> {
    if (event.type !== 'tournament.created') {
      const handler = this.handlers.get(event);
      if (handler) return handler.handle(event);
      throw new Error(`Unsupported event type ${event.type}`);
    }
    return this.persistence.processTournamentCreatedOnce(
      DurableEventConsumerService.consumerIdentity,
      event as TournamentCreatedEvent,
    );
  }

  private async publishLiveUpdate(event: EventEnvelope): Promise<void> {
    if (event.type !== 'tournament.created') return;
    const payload = event.payload as TournamentCreatedPayload;
    const liveEvent: LiveEventEnvelope<TournamentCreatedPayload> = {
      type: 'tournament.snapshot-changed',
      tournamentId: payload.tournamentId,
      payload,
    };
    try {
      await this.liveTransport.publish(this.liveChannel, liveEvent);
    } catch (error) {
      this.logger.warn(
        `Replaceable live update was missed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private get stream(): string {
    return this.config.get('EVENT_STREAM') ?? 'tournament-manager.events';
  }

  private get group(): string {
    return (
      this.config.get('EVENT_CONSUMER_GROUP') ?? 'tournament-manager-backend'
    );
  }

  private get liveChannel(): string {
    return this.config.get('LIVE_EVENT_CHANNEL') ?? 'tournament-manager.live';
  }

  private get consumerBlockMilliseconds(): number {
    return this.numberConfig('EVENT_CONSUMER_BLOCK_MS', 500, 1);
  }

  private get reclaimIdleMilliseconds(): number {
    return this.numberConfig('EVENT_RECLAIM_IDLE_MS', 250, 1);
  }

  private numberConfig(
    name: string,
    fallback: number,
    minimum: number,
  ): number {
    const value = Number(this.config.get(name) ?? fallback);
    return Number.isFinite(value) && value >= minimum ? value : fallback;
  }
}
