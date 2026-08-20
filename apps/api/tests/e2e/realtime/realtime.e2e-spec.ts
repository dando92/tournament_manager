import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { RedisLiveEventPublisher } from '@tournament-manager/live-messaging';
import type { EventEnvelope } from '@tournament-manager/live-messaging';
import { WebSocket } from 'ws';
import { RealtimeModule } from '../../../../realtime/src/realtime.module';

describe('realtime service extraction', () => {
  let replicas: INestApplication[] = [];
  let publisher: RedisLiveEventPublisher;
  const tournamentId = 910001;
  const otherTournamentId = 910002;

  beforeAll(async () => {
    process.env.LIVE_EVENT_CHANNEL = `test:realtime:${Date.now()}`;
    replicas = await Promise.all([startReplica(), startReplica()]);
    publisher = new RedisLiveEventPublisher(new ConfigService(process.env));
  });

  afterAll(async () => {
    await publisher?.onModuleDestroy();
    await Promise.all(replicas.map((app) => app.close()));
  });

  it('fans out the same scoped sequence through two replicas without tournament leakage', async () => {
    const first = await connect(replicas[0], tournamentId);
    const second = await connect(replicas[1], tournamentId);
    const unrelated = await connect(replicas[0], otherTournamentId);
    await delay(50);

    await publish({
      type: 'ui.tournament-changed',
      tournamentId,
      payload: { tournamentId },
    });
    const [firstUpdate, secondUpdate] = await Promise.all([nextMessage(first), nextMessage(second)]);
    expect(firstUpdate).toMatchObject({ event: 'TournamentUpdate', data: { tournamentId } });
    expect(secondUpdate).toMatchObject({ event: 'TournamentUpdate', sequence: firstUpdate.sequence });
    await expect(noMessage(unrelated)).resolves.toBe(true);

    first.close();
    second.close();
    unrelated.close();
  });

  it('exposes an HTTP snapshot after a disconnect and keeps sequence gaps detectable', async () => {
    const client = await connect(replicas[0], tournamentId);
    await delay(50);
    const address = replicas[0].getHttpServer().address() as { port: number };
    const before = await fetch(
      `http://127.0.0.1:${address.port}/realtime/snapshot?tournamentId=${tournamentId}&path=${encodeURIComponent('/uiupdatehub')}`,
    ).then((response) => response.json() as Promise<{ sequence: number }>);
    client.close();

    await publish({
      type: 'ui.warning',
      tournamentId,
      payload: { message: 'Recover from HTTP' },
    });

    const response = await fetch(
      `http://127.0.0.1:${address.port}/realtime/snapshot?tournamentId=${tournamentId}&path=${encodeURIComponent('/uiupdatehub')}`,
    );
    const snapshot = await response.json() as { sequence: number; messages: Array<{ event: string }> };
    expect(response.ok).toBe(true);
    expect(snapshot.sequence).toBeGreaterThan(before.sequence);
    expect(snapshot.messages).toEqual(expect.arrayContaining([expect.objectContaining({ event: 'UiWarning' })]));

    const recoveredMessages: any[] = [];
    const reconnected = new WebSocket(`ws://127.0.0.1:${address.port}/uiupdatehub?tournamentId=${tournamentId}`);
    reconnected.on('message', (data) => recoveredMessages.push(JSON.parse(data.toString())));
    await new Promise<void>((resolve, reject) => {
      reconnected.once('open', resolve);
      reconnected.once('error', reject);
    });
    await waitUntil(() => recoveredMessages.some((message) => message.event === 'UiWarning'));
    expect(recoveredMessages).toEqual(expect.arrayContaining([
      expect.objectContaining({ event: 'RealtimeReady', sequence: snapshot.sequence }),
      expect.objectContaining({ event: 'UiWarning' }),
    ]));
    reconnected.close();
  });

  async function publish(event: EventEnvelope): Promise<void> {
    await publisher.publish(event);
  }
});

async function startReplica(): Promise<INestApplication> {
  const app = await NestFactory.create(RealtimeModule, { logger: false });
  await app.listen(0, '127.0.0.1');
  return app;
}

async function connect(app: INestApplication, tournamentId: number): Promise<WebSocket> {
  const address = app.getHttpServer().address() as { port: number };
  const socket = new WebSocket(`ws://127.0.0.1:${address.port}/uiupdatehub?tournamentId=${tournamentId}`);
  await new Promise<void>((resolve, reject) => {
    socket.once('open', () => resolve());
    socket.once('error', reject);
  });
  return socket;
}

function nextMessage(socket: WebSocket): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for realtime message')), 3000);
    socket.once('message', (data) => {
      clearTimeout(timeout);
      resolve(JSON.parse(data.toString()));
    });
  });
}

function noMessage(socket: WebSocket): Promise<boolean> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      socket.off('message', onMessage);
      resolve(true);
    }, 150);
    const onMessage = () => {
      clearTimeout(timeout);
      resolve(false);
    };
    socket.once('message', onMessage);
  });
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitUntil(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 3000;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('Timed out waiting for realtime recovery');
    await delay(10);
  }
}
