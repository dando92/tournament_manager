import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { IncomingMessage } from 'http';
import { Server as WsServer, WebSocket } from 'ws';
import {
  ILobbyObserver,
  LobbyConnectionDto,
  LobbyPlayerReadyDto,
  LobbySongSelectedDto,
  SyncStartConnectionStatusDto,
} from '@syncstart/index';
import { ActiveLobbyDto, LobbyCardStateDto } from './syncstart-gateway.types';

type CachedLobbyState = {
  active: ActiveLobbyDto;
  cardState: LobbyCardStateDto;
};

@WebSocketGateway({
  path: '/lobbygateway',
  cors: {
    origin: '*',
  },
})
export class LobbyGateway implements OnGatewayInit, OnGatewayConnection, ILobbyObserver {
  @WebSocketServer()
  server: WsServer;

  private lobbyStates = new Map<string, CachedLobbyState>();
  private connectionStatusByTournament = new Map<number, SyncStartConnectionStatusDto>();
  private clientTournamentIds = new WeakMap<WebSocket, number>();

  afterInit() {}

  handleConnection(client: WebSocket, request: IncomingMessage) {
    const tournamentId = this.getTournamentIdFromRequest(request);
    if (!Number.isFinite(tournamentId)) {
      client.close();
      return;
    }

    this.clientTournamentIds.set(client, tournamentId);

    const status = this.connectionStatusByTournament.get(tournamentId);
    if (status) {
      this.sendToClient(client, 'OnSyncStartConnectionStatus', status);
    }

    this.lobbyStates.forEach(({ active, cardState }) => {
      if (active.tournamentId !== tournamentId) return;
      this.sendToClient(client, active.isConnected ? 'OnConnected' : 'OnConnectionActive', active);
      if (cardState.songTitle || cardState.songPath) {
        this.sendToClient(client, 'OnSongSelected', {
          tournamentId: cardState.tournamentId,
          lobbyId: cardState.lobbyId,
          lobbyName: cardState.lobbyName,
          lobbyCode: cardState.lobbyCode,
          songTitle: cardState.songTitle,
          songPath: cardState.songPath,
        });
      }
      cardState.players.forEach((player) => {
        this.sendToClient(client, 'OnPlayerReady', {
          tournamentId: cardState.tournamentId,
          lobbyId: cardState.lobbyId,
          lobbyName: cardState.lobbyName,
          lobbyCode: cardState.lobbyCode,
          ...player,
        });
      });
    });
  }

  OnSyncStartConnectionStatus(event: SyncStartConnectionStatusDto): void {
    this.connectionStatusByTournament.set(event.tournamentId, event);
    this.broadcastToTournament(event.tournamentId, 'OnSyncStartConnectionStatus', event);
  }

  OnConnected(event: LobbyConnectionDto): void {
    const current = this.getOrCreateLobbyState(event);
    current.active = event;
    this.lobbyStates.set(this.getLobbyStateKey(event), current);
    this.broadcastToTournament(event.tournamentId, 'OnConnected', event);
  }

  OnConnectionActive(event: LobbyConnectionDto): void {
    const current = this.getOrCreateLobbyState(event);
    current.active = event;
    this.lobbyStates.set(this.getLobbyStateKey(event), current);
    this.broadcastToTournament(event.tournamentId, 'OnConnectionActive', event);
  }

  OnDisconnection(event: LobbyConnectionDto): void {
    if (!event.isActive) {
      this.lobbyStates.delete(this.getLobbyStateKey(event));
      return;
    }

    const current = this.getOrCreateLobbyState(event);
    current.active = event;
    this.lobbyStates.set(this.getLobbyStateKey(event), current);
  }

  OnSongSelected(event: LobbySongSelectedDto): void {
    const current = this.getOrCreateLobbyState(event);
    current.cardState = {
      ...current.cardState,
      songTitle: event.song.title,
      songPath: event.song.songPath,
    };
    this.lobbyStates.set(this.getLobbyStateKey(event), current);
    this.broadcastToTournament(event.tournamentId, 'OnSongSelected', {
      tournamentId: event.tournamentId,
      lobbyId: event.lobbyId,
      lobbyName: event.lobbyName,
      lobbyCode: event.lobbyCode,
      songTitle: event.song.title,
      songPath: event.song.songPath,
    });
  }

  OnPlayerReady(event: LobbyPlayerReadyDto): void {
    const current = this.getOrCreateLobbyState(event);
    const players = current.cardState.players.filter((player) => player.playerId !== event.playerId);
    players.push({
      playerId: event.playerId,
      playerName: event.playerName,
      ready: event.ready,
    });
    current.cardState = {
      ...current.cardState,
      players: players.sort((a, b) => a.playerName.localeCompare(b.playerName)),
    };
    this.lobbyStates.set(this.getLobbyStateKey(event), current);
    this.broadcastToTournament(event.tournamentId, 'OnPlayerReady', {
      tournamentId: event.tournamentId,
      lobbyId: event.lobbyId,
      lobbyName: event.lobbyName,
      lobbyCode: event.lobbyCode,
      playerId: event.playerId,
      playerName: event.playerName,
      ready: event.ready,
    });
  }

  private getOrCreateLobbyState(identity: {
    tournamentId: number;
    lobbyId: string;
    lobbyName: string;
    lobbyCode: string;
  }): CachedLobbyState {
    const existing = this.lobbyStates.get(this.getLobbyStateKey(identity));
    if (existing) return existing;

    return {
      active: {
        tournamentId: identity.tournamentId,
        lobbyId: identity.lobbyId,
        lobbyName: identity.lobbyName,
        lobbyCode: identity.lobbyCode,
        isActive: true,
        isConnected: false,
      },
      cardState: {
        tournamentId: identity.tournamentId,
        lobbyId: identity.lobbyId,
        lobbyName: identity.lobbyName,
        lobbyCode: identity.lobbyCode,
        songTitle: '',
        songPath: '',
        players: [],
      },
    };
  }

  private sendToClient(client: WebSocket, event: string, data: unknown) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ event, data }));
    }
  }

  private broadcastToTournament(tournamentId: number, event: string, data: unknown) {
    const msg = JSON.stringify({ event, data });
    this.server.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && this.clientTournamentIds.get(client) === tournamentId) {
        client.send(msg);
      }
    });
  }

  private getLobbyStateKey(identity: { tournamentId: number; lobbyId: string }) {
    return `${identity.tournamentId}:${identity.lobbyId}`;
  }

  private getTournamentIdFromRequest(request: IncomingMessage): number {
    const requestUrl = request.url ?? '';
    const url = new URL(requestUrl, 'ws://localhost');
    return Number(url.searchParams.get('tournamentId'));
  }
}
