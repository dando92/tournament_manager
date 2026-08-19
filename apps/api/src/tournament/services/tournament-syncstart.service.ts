import { Inject, Injectable } from '@nestjs/common';
import type {
  CreatedSyncStartLobbyDto,
  SyncStartServerStatusDto,
  SyncStartLobbiesDto,
} from '@tournament-manager/contracts';
import {
  SYNCSTART_CLIENT,
  type SyncStartClient,
} from '@api/integrations/syncstart/syncstart-client';

@Injectable()
export class TournamentSyncStartService {
  constructor(
    @Inject(SYNCSTART_CLIENT)
    private readonly client: SyncStartClient,
  ) {}

  configureTournament(
    tournamentId: number,
    syncstartUrl: string,
  ): Promise<void> {
    return this.client.configureTournament({ tournamentId, syncstartUrl });
  }

  closeTournament(tournamentId: number): Promise<void> {
    return this.client.closeTournament(tournamentId);
  }

  connectServer(tournamentId: number): Promise<SyncStartServerStatusDto> {
    return this.client.connectServer(tournamentId);
  }

  disconnectServer(tournamentId: number): Promise<SyncStartServerStatusDto> {
    return this.client.disconnectServer(tournamentId);
  }

  listLobbies(tournamentId: number): Promise<SyncStartLobbiesDto> {
    return this.client.listLobbies(tournamentId);
  }

  async connectLobby(
    tournamentId: number,
    name: string | undefined,
    lobbyCode: string,
    password?: string,
  ): Promise<string> {
    const result = await this.client.connectLobby({
      tournamentId,
      lobbyName: name || lobbyCode,
      lobbyCode,
      password: password ?? '',
    });
    return result.id;
  }

  createLobby(
    tournamentId: number,
    name?: string,
    password?: string,
  ): Promise<CreatedSyncStartLobbyDto> {
    return this.client.createLobby({
      tournamentId,
      lobbyName: name ?? '',
      password: password ?? '',
    });
  }

  disconnectLobby(tournamentId: number, lobbyId: string): Promise<void> {
    return this.client.disconnectLobby(tournamentId, lobbyId);
  }
}
