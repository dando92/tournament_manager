import { Inject, Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer } from 'ws';
import type { BrowserEventBroadcaster } from './browser-event-broadcaster';
import {
  isRealtimePath,
  type RealtimeMessage,
  type RealtimePath,
} from '../realtime-message';
import {
  REALTIME_SNAPSHOT_READER,
  type RealtimeSnapshotReader,
} from '../snapshots/realtime-snapshot-reader';

type ClientScope = { tournamentId: number; path: RealtimePath };

export const BROWSER_WEBSOCKET_SERVER_FACTORY = Symbol('BROWSER_WEBSOCKET_SERVER_FACTORY');
export type BrowserWebSocketServerFactory = () => WebSocketServer;

@Injectable()
export class WebSocketBrowserEventBroadcaster
  implements BrowserEventBroadcaster, OnApplicationBootstrap, OnModuleDestroy
{
  private readonly server: WebSocketServer;
  private readonly clients = new WeakMap<WebSocket, ClientScope>();
  private upgradeHandler?: (request: IncomingMessage, socket: Duplex, head: Buffer) => void;

  constructor(
    private readonly adapterHost: HttpAdapterHost,
    @Inject(REALTIME_SNAPSHOT_READER) private readonly snapshots: RealtimeSnapshotReader,
    @Inject(BROWSER_WEBSOCKET_SERVER_FACTORY) serverFactory: BrowserWebSocketServerFactory,
  ) {
    this.server = serverFactory();
  }

  onApplicationBootstrap(): void {
    const httpServer = this.adapterHost.httpAdapter.getHttpServer();
    this.upgradeHandler = (request, socket, head) => this.handleUpgrade(request, socket, head);
    httpServer.on('upgrade', this.upgradeHandler);
  }

  onModuleDestroy(): void {
    const httpServer = this.adapterHost.httpAdapter.getHttpServer();
    if (this.upgradeHandler) httpServer.off('upgrade', this.upgradeHandler);
    for (const client of this.server.clients) client.close(1001, 'Service shutting down');
    this.server.close();
  }

  broadcast(tournamentId: number, path: RealtimePath, message: RealtimeMessage): void {
    for (const client of this.server.clients) {
      const scope = this.clients.get(client);
      if (
        scope?.tournamentId === tournamentId &&
        scope.path === path &&
        client.readyState === WebSocket.OPEN
      ) {
        client.send(JSON.stringify(message));
      }
    }
  }

  private handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): void {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (!isRealtimePath(url.pathname)) {
      socket.destroy();
      return;
    }

    const path = url.pathname;
    const tournamentId = Number(url.searchParams.get('tournamentId'));
    if (!Number.isSafeInteger(tournamentId) || tournamentId <= 0) {
      socket.destroy();
      return;
    }

    this.server.handleUpgrade(request, socket, head, (client) => {
      this.clients.set(client, { tournamentId, path });
      this.server.emit('connection', client, request);

      const snapshot = this.snapshots.snapshot(tournamentId, path);
      client.send(JSON.stringify({
        event: 'RealtimeReady',
        data: { tournamentId },
        sequence: snapshot.sequence,
      }));
      for (const message of snapshot.messages) client.send(JSON.stringify(message));
    });
  }
}
