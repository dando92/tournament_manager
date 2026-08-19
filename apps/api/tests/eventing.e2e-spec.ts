import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { createClient, RedisClientType } from 'redis';
import { DataSource } from 'typeorm';

import { EventEnvelope, LiveEventEnvelope } from '@tournament-manager/contracts';
import {
  OutboxService,
  PostgresOutboxPersistence,
  RedisEventTransport,
} from '@tournament-manager/eventing';
import { DurableEventConsumerService } from '@processor/eventing/durable-event-consumer.service';
import { EventRetentionService } from '@processor/eventing/event-retention.service';
import { OutboxRelayService } from '@processor/eventing/outbox-relay.service';
import { EventConsumerRegistry } from '@processor/eventing/event-consumer.registry';
import { PostgresEventTransaction } from '@processor/eventing/postgres-event-transaction';
import { PostgresEventRetentionPersistence } from '@processor/eventing/postgres-event-retention.persistence';
import { TournamentCreatedHandler } from '@processor/tournament-created.handler';
import { PostgresAdvisoryLock } from '@processor/persistence/postgres-advisory-lock';
import {
  Division,
  Entrant,
  Match,
  Participant,
  Phase,
  PhaseGroup,
  Player,
  Round,
  Score,
  Song,
  Standing,
  Tournament,
} from '@tournament-manager/persistence';
import { LobbySongCompletedHandler } from '@processor/lobby-song-completed.handler';
import { ScoringSystemProvider } from '@tournament/services/scoring-systems/ScoringSystemProvider';
import { TournamentService } from '@tournament/services/tournament.service';
import {
  dropTestDatabase,
  getTestDatabaseName,
  resetMigratedTestDatabase,
} from '@test/support/postgres-test-database';

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
    TOURNAMENT_TRANSPORT_RETENTION_DAYS: 0,
    TRANSPORT_RETENTION_BATCH_SIZE: 1,
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
    outbox = new OutboxService(new PostgresOutboxPersistence(dataSource));
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
      `SELECT aggregate_id, event_type, payload
         FROM event_outbox
        WHERE aggregate_id = $1`,
      [String(created.id)],
    );
    expect(rows).toEqual([
      expect.objectContaining({
        aggregate_id: String(created.id),
        event_type: 'tournament.created',
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
    await createRelay(transport).relayBatch();
    await redis.del(stream);
    const tournament = await createTournamentService(outbox).create({
      name: 'Relay recovery',
    });
    const unavailableTransport = new RedisEventTransport(config);
    await unavailableTransport.onModuleInit();
    await unavailableTransport.onApplicationShutdown();
    const failedRelay = createRelay(unavailableTransport);
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

    const restartedRelay = createRelay(transport);
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
    const live = { publish: jest.fn(), subscribe: jest.fn() };
    const registry = createTournamentCreatedRegistry(live);
    const consumer = new DurableEventConsumerService(
      new PostgresEventTransaction(dataSource),
      config,
      transport,
      registry,
    );
    await consumer.ensureGroup();
    await transport.publish(stream, event);
    await transport.publish(stream, event);
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

    const live = { publish: jest.fn(), subscribe: jest.fn() };
    const consumer = new DurableEventConsumerService(
      new PostgresEventTransaction(dataSource),
      config,
      transport,
      createTournamentCreatedRegistry(live),
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

  it('resumes a stateless song-completed handler after restart and applies duplicate delivery once', async () => {
    await redis.del(stream);
    const fixture = await createLobbyScoreFixture();
    const event = createSongCompletedEvent(fixture.tournament.id, [
      { playerId: 'one', playerName: 'Player One', score: 1000, exScore: 99, isFailed: false },
      { playerId: 'two', playerName: 'Player Two', score: 900, exScore: 95, isFailed: false },
    ]);
    const registry = new EventConsumerRegistry();
    const liveTransport = {
      publish: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn(),
    };
    const handler = new LobbySongCompletedHandler(
      registry,
      new ScoringSystemProvider(),
      config,
      liveTransport as never,
    );
    handler.onModuleInit();
    const consumer = new DurableEventConsumerService(
      new PostgresEventTransaction(dataSource),
      config,
      transport,
      registry,
    );
    await consumer.ensureGroup();

    await transport.publish(stream, event);
    const abandoned = await transport.read(
      stream,
      group,
      'stopped-handler',
      1,
      100,
    );
    expect(abandoned).toHaveLength(1);
    await delay(300);
    await expect(consumer.consumeOnce('restarted-handler', 100)).resolves.toBe(1);

    await transport.publish(stream, event);
    await expect(consumer.consumeOnce('duplicate-handler', 100)).resolves.toBe(1);

    const scores = await dataSource.getRepository(Score).find({
      where: { song: { id: fixture.song.id } },
    });
    const standings = await dataSource.getRepository(Standing).find({
      where: { round: { id: fixture.round.id } },
      relations: { score: { player: true } },
      order: { points: 'DESC' },
    });
    expect(scores).toHaveLength(2);
    expect(standings.map((standing) => standing.points)).toEqual([2, 1]);
    expect(liveTransport.publish).toHaveBeenCalledTimes(1);
    await expect(
      dataSource.query(
        `SELECT count(*)::int AS count FROM event_inbox WHERE consumer = $1 AND event_id = $2`,
        [handler.identity, event.id],
      ),
    ).resolves.toEqual([{ count: 1 }]);
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

    expect(firstMessages[0]).toMatchObject(currentSnapshot);
    expect(secondMessages[0]).toMatchObject(currentSnapshot);
    expect(missedMessages[0]).toMatchObject(currentSnapshot);
    expect(firstMessages[0].sequence).toBe(secondMessages[0].sequence);
    expect(missedMessages[0].sequence).toBeGreaterThan(firstMessages[0].sequence!);
    await Promise.all([
      unsubscribeFirst(),
      unsubscribeSecond(),
      unsubscribeMissed(),
    ]);
    await secondSubscriber.onApplicationShutdown();
  });

  it('purges all PostgreSQL and Redis transport data after the configured closed-tournament retention', async () => {
    const tournament = await createTournamentService(outbox).create({
      name: 'Retention target',
    });
    const [row] = await dataSource.query(
      `SELECT * FROM event_outbox WHERE aggregate_id = $1`,
      [String(tournament.id)],
    );
    const event = eventFromOutbox(row);
    const retentionGroup = `${group}:retention`;
    await redis.sendCommand([
      'XGROUP',
      'CREATE',
      stream,
      retentionGroup,
      '$',
      'MKSTREAM',
    ]);
    await transport.publish(stream, event);
    const pendingMessage = await transport.read(
      stream,
      retentionGroup,
      'retention-consumer',
      1,
      100,
    );
    expect(pendingMessage[0].event.id).toBe(event.id);
    await transport.deadLetter(stream, event, 'retention test', 3);
    await transport.incrementAttempt(group, event.id, event.aggregateId);
    await dataSource.query(
      `INSERT INTO event_inbox (consumer, event_id, aggregate_id)
       VALUES ('retention-test', $1, $2)`,
      [event.id, event.aggregateId],
    );
    await dataSource.query(
      `INSERT INTO tournament_event_projection (tournament_id, created_event_id, name)
       VALUES ($1, $2, $3)`,
      [tournament.id, event.id, tournament.name],
    );
    await dataSource.query(
      `UPDATE tournament SET status = 'closed', "closedAt" = now() - interval '1 day' WHERE id = $1`,
      [tournament.id],
    );

    const retention = createRetention();
    await expect(retention.sweepOnce()).resolves.toBe(1);

    await expect(
      dataSource.query(
        `SELECT
           (SELECT count(*)::int FROM event_outbox WHERE aggregate_id = $1) AS outbox,
           (SELECT count(*)::int FROM event_inbox WHERE aggregate_id = $1) AS inbox,
           (SELECT count(*)::int FROM tournament_event_projection WHERE tournament_id = $2) AS projection`,
        [event.aggregateId, tournament.id],
      ),
    ).resolves.toEqual([{ outbox: 0, inbox: 0, projection: 0 }]);
    const [lifecycle] = await dataSource.query(
      `SELECT "transportPurgedAt" FROM tournament WHERE id = $1`,
      [tournament.id],
    );
    expect(lifecycle.transportPurgedAt).not.toBeNull();

    const streamEntries = await redis.sendCommand(['XRANGE', stream, '-', '+']);
    const deadLetters = await redis.sendCommand([
      'XRANGE',
      `${stream}.dead-letter`,
      '-',
      '+',
    ]);
    expect(JSON.stringify(streamEntries)).not.toContain(event.id);
    expect(JSON.stringify(deadLetters)).not.toContain(event.id);
    const pending = (await redis.sendCommand([
      'XPENDING',
      stream,
      retentionGroup,
    ])) as unknown[];
    expect(pending[0]).toBe(0);
    await expect(
      redis.exists(`eventing:aggregate:${event.aggregateId}:transport`),
    ).resolves.toBe(0);
  });

  it('cancels pending retention when a tournament is reopened', async () => {
    const service = createTournamentService(outbox);
    const tournament = await service.create({
      name: 'Reopened retention target',
    });
    await dataSource.query(
      `UPDATE tournament SET status = 'closed', "closedAt" = now() - interval '1 day' WHERE id = $1`,
      [tournament.id],
    );

    const reopened = await service.reopen(tournament.id);
    expect(reopened.status).toBe('open');
    expect(reopened.closedAt).toBeNull();
    const retention = createRetention();
    await expect(retention.sweepOnce()).resolves.toBe(0);
    await expect(
      dataSource.query(
        `SELECT count(*)::int AS count FROM event_outbox WHERE aggregate_id = $1`,
        [String(tournament.id)],
      ),
    ).resolves.toEqual([{ count: 1 }]);
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

  function createRelay(eventTransport: RedisEventTransport): OutboxRelayService {
    return new OutboxRelayService(
      new PostgresOutboxPersistence(dataSource),
      config,
      eventTransport,
    );
  }

  function createRetention(): EventRetentionService {
    return new EventRetentionService(
      new PostgresEventRetentionPersistence(
        new PostgresAdvisoryLock(dataSource),
      ),
      config,
      transport,
    );
  }

  function createTournamentCreatedRegistry(live: {
    publish: jest.Mock;
    subscribe: jest.Mock;
  }): EventConsumerRegistry {
    const registry = new EventConsumerRegistry();
    const handler = new TournamentCreatedHandler(
      registry,
      config,
      live,
    );
    handler.onModuleInit();
    return registry;
  }

  async function createLobbyScoreFixture(): Promise<{
    tournament: Tournament;
    song: Song;
    round: Round;
  }> {
    const tournament = await dataSource.getRepository(Tournament).save({
      name: 'Stateless handler tournament',
    });
    const players = await dataSource.getRepository(Player).save([
      { playerName: 'Player One' },
      { playerName: 'Player Two' },
    ]);
    const participants = await dataSource.getRepository(Participant).save(
      players.map((player) => ({
        tournament,
        player,
        roles: ['competitor'] as Participant['roles'],
        status: 'registered' as Participant['status'],
      })),
    );
    const division = await dataSource.getRepository(Division).save({
      name: 'Division',
      tournament,
    });
    const entrants = await dataSource.getRepository(Entrant).save(
      participants.map((participant, index) => ({
        name: `Entrant ${index + 1}`,
        type: 'player' as const,
        status: 'active' as const,
        division,
        participants: [participant],
      })),
    );
    const phase = await dataSource.getRepository(Phase).save({
      name: 'Phase',
      division,
    });
    const phaseGroup = await dataSource.getRepository(PhaseGroup).save({
      name: 'Group',
      state: 'active',
      phase,
    });
    const song = await dataSource.getRepository(Song).save({
      title: 'Test Song',
      artist: 'Artist',
      group: 'Test',
      difficulty: 10,
      tournament,
    });
    const match = await dataSource.getRepository(Match).save({
      name: 'Match',
      scoringSystem: 'EurocupScoreCalculator',
      active: true,
      phaseGroup,
      entrants,
    });
    const round = await dataSource.getRepository(Round).save({ match, song });
    return { tournament, song, round };
  }
});

function eventFromOutbox(row: Record<string, unknown>): EventEnvelope {
  return {
    id: row.id as string,
    type: row.event_type as string,
    aggregateId: row.aggregate_id as string,
    payload: row.payload,
  };
}

function createEvent(tournamentId: number, payload: unknown): EventEnvelope {
  return {
    id: randomUUID(),
    type: 'tournament.created',
    aggregateId: String(tournamentId),
    payload,
  };
}

function createLiveEvent(
  tournamentId: number,
  name: string,
): LiveEventEnvelope {
  return {
    type: 'tournament.snapshot-changed',
    tournamentId,
    payload: { tournamentId, name },
  };
}

function createSongCompletedEvent(
  tournamentId: number,
  scores: Array<{
    playerId: string;
    playerName: string;
    score: number;
    exScore: number;
    isFailed: boolean;
  }>,
): EventEnvelope {
  return {
    id: randomUUID(),
    type: 'syncstart.song-completed',
    aggregateId: String(tournamentId),
    payload: {
      tournamentId,
      lobbyId: 'ABCD',
      lobbyName: 'Finals',
      lobbyCode: 'ABCD',
      song: {
        songPath: 'Test Song',
        title: 'Test Song',
        artist: 'Artist',
        songLength: 120,
      },
      scores,
    },
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
