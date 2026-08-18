import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import {
  EventEnvelope,
  isTournamentCreatedV1,
  LiveEventEnvelope,
  TournamentCreatedV1Payload,
} from '../contracts/events';
import {
  DURABLE_EVENT_TRANSPORT,
  DurableEventMessage,
  DurableEventTransport,
  LIVE_EVENT_TRANSPORT,
  LiveEventTransport,
} from './eventing.interfaces';

@Injectable()
export class DurableEventConsumerService {
  static readonly consumerIdentity = 'tournament-created-projection-v1';
  static readonly maximumAttempts = 3;
  private readonly logger = new Logger(DurableEventConsumerService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    @Inject(DURABLE_EVENT_TRANSPORT)
    private readonly durableTransport: DurableEventTransport,
    @Inject(LIVE_EVENT_TRANSPORT)
    private readonly liveTransport: LiveEventTransport,
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
    return this.dataSource.transaction(async (manager) => {
      if (!isTournamentCreatedV1(event)) {
        throw new Error(
          `Unsupported or invalid event contract ${event.type} v${event.version}`,
        );
      }
      const inserted: Array<{ event_id: string }> = await manager.query(
        `INSERT INTO event_inbox (consumer, event_id, event_type, correlation_id, aggregate_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING
         RETURNING event_id`,
        [
          DurableEventConsumerService.consumerIdentity,
          event.id,
          event.type,
          event.correlationId,
          event.aggregateId,
        ],
      );
      if (inserted.length === 0) return false;

      const payload = event.payload;
      await manager.query(
        `INSERT INTO tournament_event_projection
            (tournament_id, created_event_id, name)
           VALUES ($1, $2, $3)
           ON CONFLICT (tournament_id) DO NOTHING`,
        [payload.tournamentId, event.id, payload.name],
      );
      return true;
    });
  }

  private async publishLiveUpdate(event: EventEnvelope): Promise<void> {
    if (!isTournamentCreatedV1(event)) return;
    const payload: TournamentCreatedV1Payload = event.payload;
    const liveEvent: LiveEventEnvelope<TournamentCreatedV1Payload> = {
      type: 'tournament.snapshot-changed',
      version: 1,
      tournamentId: payload.tournamentId,
      occurredAt: new Date().toISOString(),
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
      this.config.get('EVENT_CONSUMER_GROUP') ?? 'tournament-manager-backend-v1'
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
