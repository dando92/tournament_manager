import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { createClient, RedisClientType } from 'redis';
import { DataSource } from 'typeorm';

import { EventEnvelope, LiveEventEnvelope } from '../src/contracts/events';
import { DurableEventConsumerService } from '../src/eventing/durable-event-consumer.service';
import { OutboxRelayService } from '../src/eventing/outbox-relay.service';
import { OutboxService } from '../src/eventing/outbox.service';
import { RedisEventTransport } from '../src/eventing/redis-event.transport';
import { Song, Tournament } from '../src/persistence/entities';
import { TournamentService } from '../src/tournament/services/tournament.service';
import {
  dropTestDatabase,
  getTestDatabaseName,
  resetMigratedTestDatabase,
} from './support/postgres-test-database';

describe('Eventing reliability (e2e)', () => {
  const database = getTestDatabaseName('eventing');
  const suffix = randomUUID();
  const stream = `test:tournament-manager:${suffix}`;
  const group = `test-backend:${suffix}`;
  const liveChannel = `test:live:${suffix}`;
  const redisUrl = `redis://${process.env.REDIS_HOST ?? '127.0.0.1'}:${process.env.REDIS_PORT ?? '6379'}`;
  const config = new ConfigService({
    REDIS_HOST: process.env.REDIS_HOST ?? '127.0.0.1',
    REDIS_PORT: process.env.REDIS_PORT ?? '6379',
    EVENT_STREAM: stream,
    EVENT_CONSUMER_GROUP: group,
    LIVE_EVENT_CHANNEL: liveChannel,
  });

  let dataSource: DataSource;
  let redis: RedisClientType;
  let transport: RedisEventTransport;
  let outbox: OutboxService;

  beforeAll(async () => {
    dataSource = await resetMigratedTestDatabase(database);
    redis = createClient({ url: redisUrl });
    await redis.connect();
    transport = new RedisEventTransport(config);
    await transport.onModuleInit();
    outbox = new OutboxService();
  });

  afterAll(async () => {
    await transport.onApplicationShutdown();
    await redis.del([
      stream,
      `${stream}.dead-letter`,
      `eventing:attempts:${group}`,
    ]);
    await redis.close();
    if (dataSource?.isInitialized) await dataSource.destroy();
    await dropTestDatabase(database);
  });

  it('commits a tournament and its outbox event atomically and rolls both back on failure', async () => {
    const service = createTournamentService(outbox);
    const created = await service.create({ name: 'Atomic tournament' });
    const rows = await dataSource.query(
      `SELECT aggregate_id, event_type, event_version, payload
         FROM event_outbox
        WHERE aggregate_id = $1`,
      [String(created.id)],
    );
    expect(rows).toEqual([
      expect.objectContaining({
        aggregate_id: String(created.id),
        event_type: 'tournament.created',
        event_version: 1,
        payload: { tournamentId: created.id, name: 'Atomic tournament' },
      }),
    ]);

    const failingOutbox = {
      add: jest.fn().mockRejectedValue(new Error('simulated outbox failure')),
    } as unknown as OutboxService;
    await expect(
      createTournamentService(failingOutbox).create({ name: 'Must roll back' }),
    ).rejects.toThrow('simulated outbox failure');
    await expect(
      dataSource.query(
        `SELECT count(*)::int AS count FROM tournament WHERE name = 'Must roll back'`,
      ),
    ).resolves.toEqual([{ count: 0 }]);
  });

  it('recovers relay publication after a Redis client outage without losing the outbox event', async () => {
    await new OutboxRelayService(dataSource, config, transport).relayBatch();
    await redis.del(stream);
    const tournament = await createTournamentService(outbox).create({
      name: 'Relay recovery',
    });
    const unavailableTransport = new RedisEventTransport(config);
    await unavailableTransport.onModuleInit();
    await unavailableTransport.onApplicationShutdown();
    const failedRelay = new OutboxRelayService(
      dataSource,
      config,
      unavailableTransport,
    );
    await expect(failedRelay.relayBatch()).rejects.toThrow();

    const [pending] = await dataSource.query(
      `SELECT published_at, publish_attempts, last_error
         FROM event_outbox
        WHERE aggregate_id = $1`,
      [String(tournament.id)],
    );
    expect(pending.published_at).toBeNull();
    expect(pending.publish_attempts).toBe(1);
    expect(pending.last_error).toBeTruthy();

    const restartedRelay = new OutboxRelayService(
      dataSource,
      config,
      transport,
    );
    await expect(restartedRelay.relayBatch()).resolves.toBeGreaterThanOrEqual(
      1,
    );
    const [published] = await dataSource.query(
      `SELECT published_at, publish_attempts, last_error
         FROM event_outbox
        WHERE aggregate_id = $1`,
      [String(tournament.id)],
    );
    expect(published.published_at).not.toBeNull();
    expect(published.publish_attempts).toBe(2);
    expect(published.last_error).toBeNull();
    await redis.del(stream);
  });

  it('deduplicates duplicate delivery at the inbox and business-projection boundary', async () => {
    const tournament = await createTournamentService(outbox).create({
      name: 'Deduplicated',
    });
    const [row] = await dataSource.query(
      `SELECT * FROM event_outbox WHERE aggregate_id = $1`,
      [String(tournament.id)],
    );
    const event = eventFromOutbox(row);
    await transport.publish(stream, event);
    await transport.publish(stream, event);

    const live = { publish: jest.fn(), subscribe: jest.fn() };
    const consumer = new DurableEventConsumerService(
      dataSource,
      config,
      transport,
      live,
    );
    await consumer.ensureGroup();
    await expect(consumer.consumeOnce('duplicate-test', 100)).resolves.toBe(2);

    const inbox = await dataSource.query(
      `SELECT count(*)::int AS count FROM event_inbox WHERE event_id = $1`,
      [event.id],
    );
    const projection = await dataSource.query(
      `SELECT count(*)::int AS count FROM tournament_event_projection WHERE created_event_id = $1`,
      [event.id],
    );
    expect(inbox).toEqual([{ count: 1 }]);
    expect(projection).toEqual([{ count: 1 }]);
    expect(live.publish).toHaveBeenCalledTimes(1);
  });

  it('reclaims pending work after consumer restart and dead-letters a poison message after bounded retries', async () => {
    const tournament = await createTournamentService(outbox).create({
      name: 'Poison target',
    });
    const poison = createEvent(tournament.id, {
      tournamentId: 'invalid',
      name: 42,
    });
    await transport.publish(stream, poison);

    const consumer = new DurableEventConsumerService(
      dataSource,
      config,
      transport,
      {
        publish: jest.fn(),
        subscribe: jest.fn(),
      },
    );
    await consumer.ensureGroup();
    await expect(
      consumer.consumeOnce('consumer-before-restart', 100),
    ).resolves.toBe(1);
    await delay(300);
    await expect(
      consumer.consumeOnce('consumer-after-restart', 100),
    ).resolves.toBe(1);
    await delay(300);
    await expect(
      consumer.consumeOnce('consumer-after-restart', 100),
    ).resolves.toBe(1);

    const deadLetters = (await redis.sendCommand([
      'XRANGE',
      `${stream}.dead-letter`,
      '-',
      '+',
    ])) as unknown[];
    expect(deadLetters).toHaveLength(1);
    expect(JSON.stringify(deadLetters)).toContain(poison.id);
    expect(JSON.stringify(deadLetters)).toContain('3');
    const inbox = await dataSource.query(
      `SELECT count(*)::int AS count FROM event_inbox WHERE event_id = $1`,
      [poison.id],
    );
    expect(inbox).toEqual([{ count: 0 }]);
  });

  it('fans out replaceable Pub/Sub events and recovers a missed update with a later snapshot event', async () => {
    const secondSubscriber = new RedisEventTransport(config);
    await secondSubscriber.onModuleInit();
    const firstMessages: LiveEventEnvelope[] = [];
    const secondMessages: LiveEventEnvelope[] = [];
    const missedChannel = `${liveChannel}:missed`;
    const missedMessages: LiveEventEnvelope[] = [];

    const missed = createLiveEvent(1, 'missed');
    await transport.publish(missedChannel, missed);
    const unsubscribeMissed = await secondSubscriber.subscribe(
      missedChannel,
      (event) => {
        missedMessages.push(event);
      },
    );
    await delay(50);
    expect(missedMessages).toHaveLength(0);

    const unsubscribeFirst = await transport.subscribe(liveChannel, (event) => {
      firstMessages.push(event);
    });
    const unsubscribeSecond = await secondSubscriber.subscribe(
      liveChannel,
      (event) => {
        secondMessages.push(event);
      },
    );
    await delay(50);
    const currentSnapshot = createLiveEvent(1, 'current snapshot');
    await transport.publish(liveChannel, currentSnapshot);
    await transport.publish(missedChannel, currentSnapshot);
    await waitUntil(
      () =>
        firstMessages.length === 1 &&
        secondMessages.length === 1 &&
        missedMessages.length === 1,
    );

    expect(firstMessages[0]).toEqual(currentSnapshot);
    expect(secondMessages[0]).toEqual(currentSnapshot);
    expect(missedMessages[0]).toEqual(currentSnapshot);
    await Promise.all([
      unsubscribeFirst(),
      unsubscribeSecond(),
      unsubscribeMissed(),
    ]);
    await secondSubscriber.onApplicationShutdown();
  });

  function createTournamentService(
    eventOutbox: OutboxService,
  ): TournamentService {
    return new TournamentService(
      dataSource.getRepository(Tournament),
      dataSource.getRepository(Song),
      dataSource,
      eventOutbox,
    );
  }
});

function eventFromOutbox(row: Record<string, unknown>): EventEnvelope {
  return {
    id: row.id as string,
    type: row.event_type as string,
    version: row.event_version as number,
    aggregateId: row.aggregate_id as string,
    occurredAt: (row.occurred_at as Date).toISOString(),
    correlationId: row.correlation_id as string,
    causationId: row.causation_id as string | null,
    payload: row.payload,
  };
}

function createEvent(tournamentId: number, payload: unknown): EventEnvelope {
  const id = randomUUID();
  return {
    id,
    type: 'tournament.created',
    version: 1,
    aggregateId: String(tournamentId),
    occurredAt: new Date().toISOString(),
    correlationId: id,
    causationId: null,
    payload,
  };
}

function createLiveEvent(
  tournamentId: number,
  name: string,
): LiveEventEnvelope {
  return {
    type: 'tournament.snapshot-changed',
    version: 1,
    tournamentId,
    occurredAt: new Date().toISOString(),
    payload: { tournamentId, name },
  };
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitUntil(condition: () => boolean): Promise<void> {
  const deadline = Date.now() + 2000;
  while (!condition()) {
    if (Date.now() >= deadline)
      throw new Error('Timed out waiting for Redis message');
    await delay(20);
  }
}
