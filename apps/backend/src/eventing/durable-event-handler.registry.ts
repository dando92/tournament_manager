import { Injectable } from '@nestjs/common';
import { EventEnvelope } from '../contracts/events';

export interface DurableEventHandler {
  eventType: string;
  handle(event: EventEnvelope): Promise<boolean>;
}

@Injectable()
export class DurableEventHandlerRegistry {
  private readonly handlers = new Map<string, DurableEventHandler>();

  register(handler: DurableEventHandler): void {
    if (this.handlers.has(handler.eventType)) {
      throw new Error(
        `Durable event handler ${handler.eventType} is already registered`,
      );
    }
    this.handlers.set(handler.eventType, handler);
  }

  get(event: EventEnvelope): DurableEventHandler | undefined {
    return this.handlers.get(event.type);
  }
}
