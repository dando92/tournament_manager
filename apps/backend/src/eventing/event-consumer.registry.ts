import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { EventEnvelope } from '../contracts/events';

export interface EventConsumer {
  identity: string;
  eventType: string;
  handle(manager: EntityManager, event: EventEnvelope): Promise<unknown>;
  afterCommit?(event: EventEnvelope, result: unknown): Promise<void>;
}

@Injectable()
export class EventConsumerRegistry {
  private readonly consumers = new Map<string, EventConsumer>();

  register(consumer: EventConsumer): void {
    if (this.consumers.has(consumer.eventType)) {
      throw new Error(
        `Event consumer ${consumer.eventType} is already registered`,
      );
    }
    this.consumers.set(consumer.eventType, consumer);
  }

  get(event: EventEnvelope): EventConsumer | undefined {
    return this.consumers.get(event.type);
  }
}
