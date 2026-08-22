import axios from "axios";
import {
  Tournament,
  TournamentConfiguration,
} from "@/features/tournament/model/types";
import { TournamentOverview } from "@/features/tournament/model/types";

/**
 * Every request the tournament itself answers.
 *
 * Its structure is read through `getTournamentOverview`, which returns the
 * whole tree in one response; its lobbies live in `lobbies.api.ts`, because
 * they belong to the SyncStart connection rather than to the tournament
 * record.
 */

/** What the configuration page may change. `null` clears the stored key. */
export type UpdateTournamentRequest = {
  name: string;
  syncstartUrl: string;
  startggApiKey: string | null;
  availableSetupsCount: number;
  defaultScoringSystem: string;
};

export async function listPublicTournaments(): Promise<Tournament[]> {
  const response = await axios.get<Tournament[]>("tournaments/public");
  return response.data;
}

export async function getTournament(tournamentId: number): Promise<Tournament> {
  const response = await axios.get<Tournament>(`tournaments/${tournamentId}`);
  return response.data;
}

export async function createTournament(name: string): Promise<Tournament> {
  const response = await axios.post<Tournament>("tournaments", { name });
  return response.data;
}

export async function updateTournament(
  tournamentId: number,
  request: UpdateTournamentRequest,
): Promise<void> {
  await axios.patch(`tournaments/${tournamentId}`, request);
}

export async function closeTournament(tournamentId: number): Promise<Tournament> {
  const response = await axios.post<Tournament>(`tournaments/${tournamentId}/close`);
  return response.data;
}

export async function reopenTournament(tournamentId: number): Promise<Tournament> {
  const response = await axios.post<Tournament>(`tournaments/${tournamentId}/reopen`);
  return response.data;
}

export async function getTournamentConfiguration(tournamentId: number): Promise<TournamentConfiguration> {
  const response = await axios.get<TournamentConfiguration>(`tournaments/${tournamentId}/configuration`);
  return response.data;
}

export async function getTournamentOverview(tournamentId: number): Promise<TournamentOverview> {
  const response = await axios.get<TournamentOverview>(`tournaments/${tournamentId}/overview`);
  return response.data;
}

export async function hasStartggApiKey(tournamentId: number): Promise<boolean> {
  const response = await axios.get<{ hasStartggApiKey: boolean }>(
    `tournaments/${tournamentId}/startgg/api-key-status`,
  );
  return response.data.hasStartggApiKey;
}
