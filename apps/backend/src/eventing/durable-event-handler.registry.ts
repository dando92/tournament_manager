import { Injectable } from '@nestjs/common';
import { EventEnvelope } from '../contracts/events';

export interface DurableEventHandler {
  eventType: string;
  version: number;
  handle(event: EventEnvelope): Promise<boolean>;
}

@Injectable()
export class DurableEventHandlerRegistry {
  private readonly handlers = new Map<string, DurableEventHandler>();

  register(handler: DurableEventHandler): void {
    const key = this.key(handler.eventType, handler.version);
    if (this.handlers.has(key)) {
      throw new Error(`Durable event handler ${key} is already registered`);
    }
    this.handlers.set(key, handler);
  }

  get(event: EventEnvelope): DurableEventHandler | undefined {
    return this.handlers.get(this.key(event.type, event.version));
  }

  private key(type: string, version: number): string {
    return `${type}:v${version}`;
  }
}
