import type {
  ConfigureSyncStartTournamentRequest,
  ConnectedSyncStartLobbyDto,
  ConnectSyncStartLobbyRequest,
  CreatedSyncStartLobbyDto,
  CreateSyncStartLobbyRequest,
  SyncStartServerStatusDto,
  SyncStartLobbiesDto,
} from '@tournament-manager/contracts';

export const SYNCSTART_CLIENT = Symbol('SYNCSTART_CLIENT');

export interface SyncStartClient {
  configureTournament(
    request: ConfigureSyncStartTournamentRequest,
  ): Promise<void>;
  closeTournament(tournamentId: number): Promise<void>;
  connectServer(tournamentId: number): Promise<SyncStartServerStatusDto>;
  disconnectServer(tournamentId: number): Promise<SyncStartServerStatusDto>;
  listLobbies(tournamentId: number): Promise<SyncStartLobbiesDto>;
  connectLobby(
    request: ConnectSyncStartLobbyRequest,
  ): Promise<ConnectedSyncStartLobbyDto>;
  createLobby(
    request: CreateSyncStartLobbyRequest,
  ): Promise<CreatedSyncStartLobbyDto>;
  disconnectLobby(tournamentId: number, lobbyId: string): Promise<void>;
}
