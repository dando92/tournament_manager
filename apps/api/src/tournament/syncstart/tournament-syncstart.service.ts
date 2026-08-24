import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type {
  CreatedSyncStartLobbyDto,
  SyncStartServerStatusDto,
  SyncStartLobbiesDto,
  LobbyControlOptionsDto,
} from '@tournament-manager/contracts';
import { MatchQueries } from '@match/match.queries';
import {
  SYNCSTART_CLIENT,
  type SyncStartClient,
} from '@tournament/syncstart/syncstart-client';

@Injectable()
export class TournamentSyncStartService {
  constructor(
    @Inject(SYNCSTART_CLIENT)
    private readonly client: SyncStartClient,
    private readonly matches: MatchQueries,
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

  async controlOptions(tournamentId: number): Promise<LobbyControlOptionsDto> {
    const [lobbies, songs] = await Promise.all([
      this.client.listLobbies(tournamentId),
      this.matches.activeSongsForTournament(tournamentId),
    ]);
    return { lobbies: lobbies.lobbies, songs };
  }

  async selectSong(tournamentId: number, lobbyId: string, songId: number): Promise<void> {
    const songPath = await this.activeSongPath(tournamentId, songId);
    await this.client.selectSong({ tournamentId, lobbyId, songPath });
  }

  async startSong(tournamentId: number, lobbyId: string, songId: number): Promise<void> {
    const songPath = await this.activeSongPath(tournamentId, songId);
    await this.client.startSong({ tournamentId, lobbyId, songPath });
  }

  private async activeSongPath(tournamentId: number, songId: number): Promise<string> {
    const song = await this.matches.activeSongForTournament(tournamentId, songId);
    if (!song) {
      throw new BadRequestException(`Song ${songId} is not assigned to an active match in tournament ${tournamentId}`);
    }
    return song.title;
  }
}

