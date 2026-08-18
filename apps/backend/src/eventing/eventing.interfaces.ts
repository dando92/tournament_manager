import { EventEnvelope, LiveEventEnvelope } from '../contracts/events';

export const DURABLE_EVENT_TRANSPORT = Symbol('DURABLE_EVENT_TRANSPORT');
export const LIVE_EVENT_TRANSPORT = Symbol('LIVE_EVENT_TRANSPORT');

export interface DurableEventMessage {
  streamId: string;
  event: EventEnvelope;
}

export interface DurableEventTransport {
  publish(stream: string, event: EventEnvelope): Promise<string>;
  ensureConsumerGroup(stream: string, group: string): Promise<void>;
  read(
    stream: string,
    group: string,
    consumer: string,
    count: number,
    blockMilliseconds: number,
  ): Promise<DurableEventMessage[]>;
  claimStale(
    stream: string,
    group: string,
    consumer: string,
    minIdleMilliseconds: number,
    count: number,
  ): Promise<DurableEventMessage[]>;
  acknowledge(stream: string, group: string, streamId: string): Promise<void>;
  incrementAttempt(
    group: string,
    eventId: string,
    aggregateId: string,
  ): Promise<number>;
  clearAttempt(group: string, eventId: string): Promise<void>;
  deleteAggregate(aggregateId: string): Promise<void>;
  deadLetter(
    stream: string,
    event: EventEnvelope,
    reason: string,
    attempts: number,
  ): Promise<void>;
}

export interface LiveEventTransport {
  publish(channel: string, event: LiveEventEnvelope): Promise<void>;
  subscribe(
    channel: string,
    listener: (event: LiveEventEnvelope) => void | Promise<void>,
  ): Promise<() => Promise<void>>;
}
