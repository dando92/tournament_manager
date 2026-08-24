import axios from "axios";
import type {
  SyncStartLobbiesDto,
  SyncStartServerStatusDto,
  LobbyControlOptionsDto,
  LobbyControlCommandRequest,
} from "@tournament-manager/contracts";

/**
 * The SyncStart connection a tournament owns: the server it is attached to,
 * and the lobbies it spectates through that server.
 *
 * The live state of a lobby — its song, its players, their readiness — does
 * not arrive here. It is pushed over the lobby gateway, so these routes only
 * open, close and list connections.
 */

export type SpectateLobbyRequest = {
  name: string;
  lobbyCode: string;
  password: string;
};

export type CreateLobbyRequest = {
  name?: string;
  password: string;
};

export async function listTournamentLobbies(tournamentId: number): Promise<SyncStartLobbiesDto> {
  const response = await axios.get<SyncStartLobbiesDto>(`tournaments/${tournamentId}/lobbies`);
  return response.data;
}

export async function connectLobbyServer(tournamentId: number): Promise<SyncStartServerStatusDto> {
  const response = await axios.post<SyncStartServerStatusDto>(
    `tournaments/${tournamentId}/lobbies/server/connect`,
  );
  return response.data;
}

export async function disconnectLobbyServer(tournamentId: number): Promise<SyncStartServerStatusDto> {
  const response = await axios.delete<SyncStartServerStatusDto>(
    `tournaments/${tournamentId}/lobbies/server/disconnect`,
  );
  return response.data;
}

export async function spectateLobby(tournamentId: number, request: SpectateLobbyRequest): Promise<void> {
  await axios.post(`tournaments/${tournamentId}/lobbies/connect`, request);
}

export async function createLobby(tournamentId: number, request: CreateLobbyRequest): Promise<void> {
  await axios.post(`tournaments/${tournamentId}/lobbies/create`, request);
}

export async function disconnectLobby(tournamentId: number, lobbyId: string): Promise<void> {
  await axios.delete(`tournaments/${tournamentId}/lobbies/${lobbyId}/disconnect`);
}

export const lobbyControlKeys = {
  options: (tournamentId: number) => ["lobby-control", tournamentId] as const,
};

export async function getLobbyControlOptions(tournamentId: number): Promise<LobbyControlOptionsDto> {
  const response = await axios.get<LobbyControlOptionsDto>(`tournaments/${tournamentId}/lobbies/control-options`);
  return response.data;
}

export async function selectLobbySong(tournamentId: number, lobbyId: string, songId: number): Promise<void> {
  const request: LobbyControlCommandRequest = { songId };
  await axios.post(`tournaments/${tournamentId}/lobbies/${encodeURIComponent(lobbyId)}/select-song`, request);
}

export async function startLobbySong(tournamentId: number, lobbyId: string, songId: number): Promise<void> {
  const request: LobbyControlCommandRequest = { songId };
  await axios.post(`tournaments/${tournamentId}/lobbies/${encodeURIComponent(lobbyId)}/start`, request);
}
