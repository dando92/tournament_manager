import { BadGatewayException, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import type {
  ConfigureSyncStartTournamentRequest,
  ConnectedSyncStartLobbyDto,
  ConnectSyncStartLobbyRequest,
  CreatedSyncStartLobbyDto,
  CreateSyncStartLobbyRequest,
  SyncStartLobbySongCommandRequest,
  SyncStartServerStatusDto,
  SyncStartLobbiesDto,
} from '@tournament-manager/contracts';
import type { SyncStartClient } from './syncstart-client';

@Injectable()
export class HttpSyncStartClient implements SyncStartClient {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  async configureTournament(
    request: ConfigureSyncStartTournamentRequest,
  ): Promise<void> {
    await this.request(
      'PUT',
      `${this.tournamentPath(request.tournamentId)}/configuration`,
      { syncstartUrl: request.syncstartUrl },
    );
  }

  async closeTournament(tournamentId: number): Promise<void> {
    await this.request(
      'DELETE',
      `${this.tournamentPath(tournamentId)}/configuration`,
    );
  }

  connectServer(tournamentId: number): Promise<SyncStartServerStatusDto> {
    return this.request(
      'POST',
      `${this.tournamentPath(tournamentId)}/server/connect`,
    );
  }

  disconnectServer(tournamentId: number): Promise<SyncStartServerStatusDto> {
    return this.request(
      'DELETE',
      `${this.tournamentPath(tournamentId)}/server/disconnect`,
    );
  }

  listLobbies(tournamentId: number): Promise<SyncStartLobbiesDto> {
    return this.request('GET', `${this.tournamentPath(tournamentId)}/lobbies`);
  }

  connectLobby(
    request: ConnectSyncStartLobbyRequest,
  ): Promise<ConnectedSyncStartLobbyDto> {
    return this.request(
      'POST',
      `${this.tournamentPath(request.tournamentId)}/lobbies/connect`,
      {
        lobbyName: request.lobbyName,
        lobbyCode: request.lobbyCode,
        password: request.password,
      },
    );
  }

  createLobby(
    request: CreateSyncStartLobbyRequest,
  ): Promise<CreatedSyncStartLobbyDto> {
    return this.request(
      'POST',
      `${this.tournamentPath(request.tournamentId)}/lobbies`,
      {
        lobbyName: request.lobbyName,
        password: request.password,
      },
    );
  }

  async disconnectLobby(tournamentId: number, lobbyId: string): Promise<void> {
    await this.request(
      'DELETE',
      `${this.tournamentPath(tournamentId)}/lobbies/${encodeURIComponent(lobbyId)}`,
    );
  }

  async selectSong(request: SyncStartLobbySongCommandRequest): Promise<void> {
    await this.lobbySongCommand(request, 'select-song');
  }

  async startSong(request: SyncStartLobbySongCommandRequest): Promise<void> {
    await this.lobbySongCommand(request, 'start');
  }

  private async lobbySongCommand(request: SyncStartLobbySongCommandRequest, command: string): Promise<void> {
    await this.request(
      'POST',
      `${this.tournamentPath(request.tournamentId)}/lobbies/${encodeURIComponent(request.lobbyId)}/${command}`,
      { songPath: request.songPath },
    );
  }

  private tournamentPath(tournamentId: number): string {
    return `/internal/tournaments/${tournamentId}`;
  }

  private async request<T>(
    method: string,
    path: string,
    data?: unknown,
  ): Promise<T> {
    try {
      const response = await firstValueFrom(
        this.http.request<T>({
          method,
          url: `${this.config.getOrThrow<string>('SYNCSTART_INTERNAL_URL')}${path}`,
          data,
          timeout: Number(this.config.get('INTERNAL_HTTP_TIMEOUT_MS') ?? 5000),
          headers: {
            'content-type': 'application/json',
            'x-internal-service-token': this.config.getOrThrow<string>(
              'INTERNAL_SERVICE_TOKEN',
            ),
          },
        }),
      );
      if (response.status < 200 || response.status >= 300) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.data;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new BadGatewayException(`SyncStart request failed: ${detail}`);
    }
  }
}
