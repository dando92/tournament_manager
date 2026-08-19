import { Inject, Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost } from '@nestjs/core';
import {
  LIVE_EVENT_SUBSCRIBER,
  type LiveEventSubscriber,
  type SequencedLiveEventEnvelope,
} from '@tournament-manager/live-messaging';
import type { IncomingMessage } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { mapRealtimeEvent, RealtimeMessage, RealtimePath } from './realtime-event.mapper';

type ClientScope = { tournamentId: number; path: RealtimePath };

@Injectable()
export class RealtimeGateway implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly server = new WebSocketServer({ noServer: true });
  private readonly clients = new WeakMap<WebSocket, ClientScope>();
  private readonly snapshots = new Map<string, Map<string, RealtimeMessage>>();
  private readonly liveMatchStates = new Map<string, unknown>();
  private readonly lastSequence = new Map<number, number>();
  private unsubscribe?: () => Promise<void>;
  private upgradeHandler?: (request: IncomingMessage, socket: any, head: Buffer) => void;

  constructor(
    private readonly config: ConfigService,
    private readonly adapterHost: HttpAdapterHost,
    @Inject(LIVE_EVENT_SUBSCRIBER) private readonly transport: LiveEventSubscriber,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const httpServer = this.adapterHost.httpAdapter.getHttpServer();
    this.upgradeHandler = (request, socket, head) => this.handleUpgrade(request, socket, head);
    httpServer.on('upgrade', this.upgradeHandler);
    this.unsubscribe = await this.transport.subscribe((event) => this.forward(event));
  }

  async onModuleDestroy(): Promise<void> {
    const httpServer = this.adapterHost.httpAdapter.getHttpServer();
    if (this.upgradeHandler) httpServer.off('upgrade', this.upgradeHandler);
    await this.unsubscribe?.();
    for (const client of this.server.clients) client.close(1001, 'Service shutting down');
    this.server.close();
  }

  snapshot(tournamentId: number, path: RealtimePath): { sequence: number; messages: RealtimeMessage[] } {
    return {
      sequence: this.lastSequence.get(tournamentId) ?? 0,
      messages: Array.from(this.snapshots.get(this.snapshotKey(tournamentId, path))?.values() ?? []),
    };
  }

  private handleUpgrade(request: IncomingMessage, socket: any, head: Buffer): void {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (!isRealtimePath(url.pathname)) return socket.destroy();
    const path = url.pathname;
    const tournamentId = Number(url.searchParams.get('tournamentId'));
    if (!Number.isSafeInteger(tournamentId) || tournamentId <= 0) return socket.destroy();

    this.server.handleUpgrade(request, socket, head, (client) => {
      this.clients.set(client, { tournamentId, path });
      this.server.emit('connection', client, request);
      client.send(JSON.stringify({
        event: 'RealtimeReady',
        data: { tournamentId },
        sequence: this.lastSequence.get(tournamentId) ?? 0,
      }));
      for (const message of this.snapshot(tournamentId, path).messages)
        client.send(JSON.stringify(message));
    });
  }

  private forward(event: SequencedLiveEventEnvelope): void {
    if (typeof event.sequence !== 'number') event.sequence = (this.lastSequence.get(event.tournamentId) ?? 0) + 1;
    this.lastSequence.set(event.tournamentId, event.sequence);
    const lobbyPayload = event.payload as { lobbyId?: string; isActive?: boolean };
    if (event.type === 'syncstart.lobby-disconnected' && lobbyPayload.lobbyId && !lobbyPayload.isActive)
      this.clearLobby(event.tournamentId, lobbyPayload.lobbyId);
    const mapped = new Map<RealtimePath, RealtimeMessage>();
    for (const path of realtimePaths) {
      const liveMatchKey = lobbyPayload.lobbyId ? `${event.tournamentId}:${lobbyPayload.lobbyId}` : undefined;
      const message = mapRealtimeEvent(event, path, liveMatchKey ? this.liveMatchStates.get(liveMatchKey) as any : undefined);
      if (!message) continue;
      mapped.set(path, message);
      this.cache(event.tournamentId, path, message);
      if (path === '/livematchgateway' && liveMatchKey && message.event !== 'RealtimeSequence')
        this.liveMatchStates.set(liveMatchKey, message.data);
    }

    for (const client of this.server.clients) {
      const scope = this.clients.get(client);
      if (!scope || scope.tournamentId !== event.tournamentId || client.readyState !== WebSocket.OPEN) continue;
      const message = mapped.get(scope.path);
      if (message) client.send(JSON.stringify(message));
    }
  }

  private cache(tournamentId: number, path: RealtimePath, message: RealtimeMessage): void {
    if (message.event === 'RealtimeSequence') return;
    const key = this.snapshotKey(tournamentId, path);
    const messages = this.snapshots.get(key) ?? new Map<string, RealtimeMessage>();
    messages.set(messageIdentity(message), message);
    this.snapshots.set(key, messages);
  }

  private clearLobby(tournamentId: number, lobbyId: string): void {
    this.liveMatchStates.delete(`${tournamentId}:${lobbyId}`);
    for (const path of realtimePaths) {
      const messages = this.snapshots.get(this.snapshotKey(tournamentId, path));
      if (!messages) continue;
      for (const [key, message] of messages) {
        if ((message.data as { lobbyId?: string })?.lobbyId === lobbyId) messages.delete(key);
      }
    }
  }

  private snapshotKey(tournamentId: number, path: RealtimePath): string {
    return `${tournamentId}:${path}`;
  }

  private get liveChannel(): string {
    return this.config.get('LIVE_EVENT_CHANNEL') ?? 'tournament-manager.live';
  }
}

const realtimePaths: RealtimePath[] = ['/uiupdatehub', '/lobbygateway', '/livematchgateway'];

function isRealtimePath(path: string): path is RealtimePath {
  return realtimePaths.includes(path as RealtimePath);
}

function messageIdentity(message: RealtimeMessage): string {
  const data = message.data as { lobbyId?: string; playerId?: string; matchId?: number } | undefined;
  if (data?.playerId) return `${message.event}:lobby:${data.lobbyId}:player:${data.playerId}`;
  if (data?.matchId) return `${message.event}:match:${data.matchId}`;
  return data?.lobbyId ? `${message.event}:lobby:${data.lobbyId}` : message.event;
}
