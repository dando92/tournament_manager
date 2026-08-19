import {
  Injectable,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';
import {
  EventEnvelope,
  isEventEnvelope,
  LiveEventEnvelope,
} from '@tournament-manager/contracts';
import {
  DurableEventMessage,
  DurableEventTransport,
  LiveEventTransport,
} from '@eventing/interfaces';

type RedisReply = unknown;

@Injectable()
export class RedisEventTransport
  implements
    DurableEventTransport,
    LiveEventTransport,
    OnModuleInit,
    OnApplicationShutdown
{
  private readonly commandClient: RedisClientType;
  private readonly readClient: RedisClientType;
  private readonly subscriberClient: RedisClientType;

  constructor(config: ConfigService) {
    const host = config.get('REDIS_HOST') ?? '127.0.0.1';
    const port = config.get('REDIS_PORT') ?? '6379';
    const url = `redis://${host}:${port}`;
    this.commandClient = createClient({ url });
    this.readClient = this.commandClient.duplicate();
    this.subscriberClient = this.commandClient.duplicate();
  }

  async onModuleInit(): Promise<void> {
    await Promise.all([
      this.commandClient.connect(),
      this.readClient.connect(),
      this.subscriberClient.connect(),
    ]);
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.allSettled([
      this.commandClient.close(),
      this.readClient.close(),
      this.subscriberClient.close(),
    ]);
  }

  async publish(stream: string, event: EventEnvelope): Promise<string>;
  async publish(channel: string, event: LiveEventEnvelope): Promise<void>;
  async publish(
    destination: string,
    event: EventEnvelope | LiveEventEnvelope,
  ): Promise<string | void> {
    if ('id' in event) {
      return this.addIndexedStreamEntry(destination, event.aggregateId, [
        'eventId',
        event.id,
        'aggregateId',
        event.aggregateId,
        'event',
        JSON.stringify(event),
      ]);
    }
    await this.commandClient.publish(destination, JSON.stringify(event));
  }

  async ensureConsumerGroup(stream: string, group: string): Promise<void> {
    try {
      await this.commandClient.sendCommand([
        'XGROUP',
        'CREATE',
        stream,
        group,
        '$',
        'MKSTREAM',
      ]);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('BUSYGROUP'))
        throw error;
    }
  }

  async read(
    stream: string,
    group: string,
    consumer: string,
    count: number,
    blockMilliseconds: number,
  ): Promise<DurableEventMessage[]> {
    const reply = await this.readClient.sendCommand([
      'XREADGROUP',
      'GROUP',
      group,
      consumer,
      'COUNT',
      String(count),
      'BLOCK',
      String(blockMilliseconds),
      'STREAMS',
      stream,
      '>',
    ]);
    return this.parseReadReply(reply);
  }

  async claimStale(
    stream: string,
    group: string,
    consumer: string,
    minIdleMilliseconds: number,
    count: number,
  ): Promise<DurableEventMessage[]> {
    const reply = await this.commandClient.sendCommand([
      'XAUTOCLAIM',
      stream,
      group,
      consumer,
      String(minIdleMilliseconds),
      '0-0',
      'COUNT',
      String(count),
    ]);
    if (!Array.isArray(reply) || !Array.isArray(reply[1])) return [];
    return this.parseEntries(reply[1] as unknown[]);
  }

  async acknowledge(
    stream: string,
    group: string,
    streamId: string,
  ): Promise<void> {
    await this.commandClient.sendCommand(['XACK', stream, group, streamId]);
  }

  async incrementAttempt(
    group: string,
    eventId: string,
    aggregateId: string,
  ): Promise<number> {
    const key = `eventing:attempts:${group}`;
    const attempts = await this.commandClient.hIncrBy(key, eventId, 1);
    await this.commandClient.sAdd(
      this.aggregateIndexKey(aggregateId),
      JSON.stringify({ kind: 'hash', key, field: eventId }),
    );
    await this.commandClient.expire(key, 7 * 24 * 60 * 60);
    return attempts;
  }

  async clearAttempt(group: string, eventId: string): Promise<void> {
    await this.commandClient.hDel(`eventing:attempts:${group}`, eventId);
  }

  async deadLetter(
    stream: string,
    event: EventEnvelope,
    reason: string,
    attempts: number,
  ): Promise<void> {
    await this.addIndexedStreamEntry(
      `${stream}.dead-letter`,
      event.aggregateId,
      [
        'eventId',
        event.id,
        'aggregateId',
        event.aggregateId,
        'event',
        JSON.stringify(event),
        'reason',
        reason,
        'attempts',
        String(attempts),
        'failedAt',
        new Date().toISOString(),
      ],
    );
  }

  async deleteAggregate(aggregateId: string): Promise<void> {
    const indexKey = this.aggregateIndexKey(aggregateId);
    const members = await this.commandClient.sMembers(indexKey);
    for (const member of members) {
      const entry = JSON.parse(member) as {
        kind: 'stream' | 'hash';
        key: string;
        id?: string;
        field?: string;
      };
      if (entry.kind === 'stream' && entry.id) {
        await this.acknowledgeAllGroups(entry.key, entry.id);
        await this.commandClient.sendCommand(['XDEL', entry.key, entry.id]);
      } else if (entry.kind === 'hash' && entry.field) {
        await this.commandClient.hDel(entry.key, entry.field);
      }
    }
    await this.commandClient.del(indexKey);
  }

  async subscribe(
    channel: string,
    listener: (event: LiveEventEnvelope) => void | Promise<void>,
  ): Promise<() => Promise<void>> {
    await this.subscriberClient.subscribe(channel, async (message) => {
      const parsed: unknown = JSON.parse(message);
      await listener(parsed as LiveEventEnvelope);
    });
    return async () => this.subscriberClient.unsubscribe(channel);
  }

  private parseReadReply(reply: RedisReply): DurableEventMessage[] {
    if (!Array.isArray(reply)) return [];
    const result: DurableEventMessage[] = [];
    for (const streamReply of reply) {
      if (!Array.isArray(streamReply) || !Array.isArray(streamReply[1]))
        continue;
      result.push(...this.parseEntries(streamReply[1] as unknown[]));
    }
    return result;
  }

  private async addIndexedStreamEntry(
    stream: string,
    aggregateId: string,
    fields: string[],
  ): Promise<string> {
    const script = `
      local id = redis.call('XADD', KEYS[1], '*', unpack(ARGV))
      redis.call('SADD', KEYS[2], cjson.encode({kind='stream', key=KEYS[1], id=id}))
      return id
    `;
    const reply = await this.commandClient.sendCommand([
      'EVAL',
      script,
      '2',
      stream,
      this.aggregateIndexKey(aggregateId),
      ...fields,
    ]);
    return String(reply);
  }

  private aggregateIndexKey(aggregateId: string): string {
    return `eventing:aggregate:${aggregateId}:transport`;
  }

  private async acknowledgeAllGroups(
    stream: string,
    streamId: string,
  ): Promise<void> {
    let groups: unknown;
    try {
      groups = await this.commandClient.sendCommand([
        'XINFO',
        'GROUPS',
        stream,
      ]);
    } catch (error) {
      if (error instanceof Error && error.message.includes('no such key'))
        return;
      throw error;
    }
    if (!Array.isArray(groups)) return;
    for (const group of groups) {
      if (!Array.isArray(group)) continue;
      const nameIndex = group.findIndex((value) => value === 'name');
      const name = group[nameIndex + 1];
      if (nameIndex >= 0 && typeof name === 'string') {
        await this.commandClient.sendCommand(['XACK', stream, name, streamId]);
      }
    }
  }

  private parseEntries(entries: unknown[]): DurableEventMessage[] {
    const messages: DurableEventMessage[] = [];
    for (const entry of entries) {
      if (
        !Array.isArray(entry) ||
        typeof entry[0] !== 'string' ||
        !Array.isArray(entry[1])
      )
        continue;
      const fields = entry[1] as unknown[];
      const eventIndex = fields.findIndex((field) => field === 'event');
      if (eventIndex < 0 || typeof fields[eventIndex + 1] !== 'string')
        continue;
      const event: unknown = JSON.parse(fields[eventIndex + 1] as string);
      if (!isEventEnvelope(event))
        throw new Error(`Invalid event envelope at stream entry ${entry[0]}`);
      messages.push({ streamId: entry[0], event });
    }
    return messages;
  }
}
