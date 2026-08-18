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
  LobbyMatchUpdateDto,
  LobbySongCompletedDto,
  LobbySongSelectedDto,
} from '@syncstart/index';
import { LiveMatchStateDto } from './syncstart-gateway.types';

type CachedLiveMatchState = {
  lastEvent: 'OnSongSelected' | 'OnMatchUpdate' | 'OnSongCompleted';
  state: LiveMatchStateDto;
};

@WebSocketGateway({
  path: '/livematchgateway',
  cors: {
    origin: '*',
  },
})
export class LiveMatchGateway implements OnGatewayInit, OnGatewayConnection, ILobbyObserver {
  @WebSocketServer()
  server: WsServer;

  private liveMatchStates = new Map<string, CachedLiveMatchState>();
  private clientTournamentIds = new WeakMap<WebSocket, number>();

  afterInit() {}

  handleConnection(client: WebSocket, request: IncomingMessage) {
    const tournamentId = this.getTournamentIdFromRequest(request);
    if (!Number.isFinite(tournamentId)) {
      client.close();
      return;
    }

    this.clientTournamentIds.set(client, tournamentId);

    this.liveMatchStates.forEach(({ lastEvent, state }) => {
      if (state.tournamentId !== tournamentId) return;
      this.sendToClient(client, lastEvent, state);
    });
  }

  OnSongSelected(event: LobbySongSelectedDto): void {
    const state: LiveMatchStateDto = {
      tournamentId: event.tournamentId,
      lobbyId: event.lobbyId,
      lobbyName: event.lobbyName,
      lobbyCode: event.lobbyCode,
      songTitle: event.song.title,
      songPath: event.song.songPath,
      players: [],
    };
    this.liveMatchStates.set(this.getLobbyStateKey(event), {
      lastEvent: 'OnSongSelected',
      state,
    });
    this.broadcastToTournament(event.tournamentId, 'OnSongSelected', state);
  }

  OnGoingMatchUpdate(event: LobbyMatchUpdateDto): void {
    const previous = this.liveMatchStates.get(this.getLobbyStateKey(event))?.state;
    const state: LiveMatchStateDto = {
      tournamentId: event.tournamentId,
      lobbyId: event.lobbyId,
      lobbyName: event.lobbyName,
      lobbyCode: event.lobbyCode,
      songTitle: event.song?.title ?? previous?.songTitle ?? '',
      songPath: event.song?.songPath ?? previous?.songPath ?? '',
      players: event.players.map((player) => ({
        playerId: player.playerId,
        playerName: player.playerName,
        score: player.score,
        exScore: player.exScore,
        isFailed: player.isFailed,
        songProgression: player.songProgression,
        judgments: player.judgments,
      })),
    };
    this.liveMatchStates.set(this.getLobbyStateKey(event), {
      lastEvent: 'OnMatchUpdate',
      state,
    });
    this.broadcastToTournament(event.tournamentId, 'OnMatchUpdate', state);
  }

  OnSongCompleted(event: LobbySongCompletedDto): void {
    const state: LiveMatchStateDto = {
      tournamentId: event.tournamentId,
      lobbyId: event.lobbyId,
      lobbyName: event.lobbyName,
      lobbyCode: event.lobbyCode,
      songTitle: event.song.title,
      songPath: event.song.songPath,
      players: event.scores.map((score) => ({
        playerId: score.playerId,
        playerName: score.playerName,
        score: score.score,
        exScore: score.exScore,
        isFailed: score.isFailed,
        isCompleted: true,
      })),
    };
    this.liveMatchStates.set(this.getLobbyStateKey(event), {
      lastEvent: 'OnSongCompleted',
      state,
    });
    this.broadcastToTournament(event.tournamentId, 'OnSongCompleted', state);
  }

  OnDisconnection(event: LobbyConnectionDto): void {
    if (!event.isActive) {
      this.liveMatchStates.delete(this.getLobbyStateKey(event));
    }
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
