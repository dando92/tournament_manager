import axios from "axios";
import { Entrant } from "@/features/entrant/types/Entrant";
import {
  GenerateBracketRequest,
  GenerateBracketResultDto,
} from "@/features/division/types/GenerateBracket";

export type DivisionSummary = {
  id: number;
  name: string;
};

export async function createDivision(tournamentId: number, name: string): Promise<DivisionSummary> {
  const response = await axios.post<DivisionSummary>("divisions", { tournamentId, name });
  return response.data;
}

export async function renameDivision(divisionId: number, name: string): Promise<DivisionSummary> {
  const response = await axios.patch<DivisionSummary>(`divisions/${divisionId}`, { name });
  return response.data;
}

export async function deleteDivision(divisionId: number): Promise<void> {
  await axios.delete(`divisions/${divisionId}`);
}

export async function listDivisionEntrants(divisionId: number): Promise<Entrant[]> {
  const response = await axios.get<Entrant[]>(`divisions/${divisionId}/entrants`);
  return response.data;
}

export async function updateDivisionSeeding(divisionId: number, entrantIds: number[]): Promise<void> {
  await axios.patch(`divisions/${divisionId}/entrants/seeding`, { entrantIds });
}

export async function listBracketTypes(): Promise<string[]> {
  const response = await axios.get<string[]>("bracket/bracket-types");
  return response.data;
}

export async function generateBracket(request: GenerateBracketRequest): Promise<GenerateBracketResultDto> {
  const response = await axios.post<GenerateBracketResultDto>(
    `divisions/${request.divisionId}/generate-bracket`,
    {
      phaseName: request.phaseName,
      bracketType: request.bracketType,
      playerPerMatch: request.playerPerMatch,
    },
  );
  return response.data;
}
