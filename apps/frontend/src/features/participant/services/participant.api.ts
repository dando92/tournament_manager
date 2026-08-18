import axios from "axios";
import { Participant } from "@/features/entrant/types/Entrant";
import { Player } from "@/features/player/types/Player";

export type ParticipantImportPreviewEntry = {
  name: string;
  matchedPlayer: Player | null;
  alreadyParticipant: boolean;
};

export async function listParticipants(tournamentId: number): Promise<Participant[]> {
  const response = await axios.get<Participant[]>(`tournaments/${tournamentId}/participants`);
  return response.data;
}

export async function createParticipant(
  tournamentId: number,
  payload: { playerId?: number; playerName?: string },
): Promise<Participant> {
  const response = await axios.post<Participant>(`tournaments/${tournamentId}/participants`, payload);
  return response.data;
}

export async function removeParticipant(tournamentId: number, participantId: number): Promise<void> {
  await axios.delete(`tournaments/${tournamentId}/participants/${participantId}`);
}

export async function makeParticipantStaff(tournamentId: number, participantId: number): Promise<Participant> {
  const response = await axios.post<Participant>(`tournaments/${tournamentId}/participants/${participantId}/staff`);
  return response.data;
}

export async function removeParticipantStaff(tournamentId: number, participantId: number): Promise<Participant> {
  const response = await axios.delete<Participant>(`tournaments/${tournamentId}/participants/${participantId}/staff`);
  return response.data;
}

export async function previewParticipantImport(
  tournamentId: number,
  playerNames: string[],
): Promise<ParticipantImportPreviewEntry[]> {
  const response = await axios.post<ParticipantImportPreviewEntry[]>(
    `tournaments/${tournamentId}/participants/import-preview`,
    { playerNames },
  );
  return response.data;
}

export async function importParticipants(
  tournamentId: number,
  entries: Array<{ name: string; playerId?: number }>,
): Promise<Participant[]> {
  const response = await axios.post<Participant[]>(`tournaments/${tournamentId}/participants/import`, { entries });
  return response.data;
}

export async function listAvailableParticipantsForDivision(divisionId: number): Promise<Participant[]> {
  const response = await axios.get<Participant[]>(`divisions/${divisionId}/available-participants`);
  return response.data;
}

export async function addParticipantToDivision(divisionId: number, participantId: number): Promise<void> {
  await axios.post(`divisions/${divisionId}/participants/${participantId}`);
}

export async function removeParticipantFromDivision(divisionId: number, participantId: number): Promise<void> {
  await axios.delete(`divisions/${divisionId}/participants/${participantId}`);
}
