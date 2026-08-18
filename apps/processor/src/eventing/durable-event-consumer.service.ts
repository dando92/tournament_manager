import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEnvelope } from '@tournament-manager/contracts';
import {
  DURABLE_EVENT_TRANSPORT,
  DurableEventMessage,
  DurableEventTransport,
} from '../../../backend/src/eventing/eventing.interfaces';
import { PostgresEventTransaction } from './postgres-event-transaction';
import { EventConsumerRegistry } from './event-consumer.registry';

@Injectable()
export class DurableEventConsumerService {
  static readonly maximumAttempts = 3;
  private readonly logger = new Logger(DurableEventConsumerService.name);

  constructor(
    private readonly transaction: PostgresEventTransaction,
    private readonly config: ConfigService,
    @Inject(DURABLE_EVENT_TRANSPORT)
    private readonly durableTransport: DurableEventTransport,
    private readonly consumers: EventConsumerRegistry,
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
      await this.handleIdempotently(message.event);
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
    const consumer = this.consumers.get(event);
    if (!consumer) throw new Error(`Unsupported event type ${event.type}`);
    return this.transaction.processOnce(event, consumer);
  }

  private get stream(): string {
    return this.config.get('EVENT_STREAM') ?? 'tournament-manager.events';
  }

  private get group(): string {
    return (
      this.config.get('EVENT_CONSUMER_GROUP') ?? 'tournament-manager-processor'
    );
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
