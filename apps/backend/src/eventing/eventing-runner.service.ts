import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DurableEventConsumerService } from './durable-event-consumer.service';
import { OutboxRelayService } from './outbox-relay.service';

@Injectable()
export class EventingRunnerService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(EventingRunnerService.name);
  private readonly consumer = `backend-${randomUUID()}`;
  private stopped = false;
  private relayLoop?: Promise<void>;
  private consumerLoop?: Promise<void>;

  constructor(
    private readonly relay: OutboxRelayService,
    private readonly durableConsumer: DurableEventConsumerService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.durableConsumer.ensureGroup();
    this.relayLoop = this.runRelay();
    this.consumerLoop = this.runConsumer();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    await Promise.allSettled([this.relayLoop, this.consumerLoop]);
  }

  private async runRelay(): Promise<void> {
    while (!this.stopped) {
      try {
        const count = await this.relay.relayBatch();
        if (count === 0) await this.delay(200);
      } catch {
        await this.delay(1000);
      }
    }
  }

  private async runConsumer(): Promise<void> {
    while (!this.stopped) {
      try {
        await this.durableConsumer.consumeOnce(this.consumer, 500);
      } catch (error) {
        this.logger.error(
          `Durable consumer loop failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        await this.delay(1000);
      }
    }
  }

  private delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}
