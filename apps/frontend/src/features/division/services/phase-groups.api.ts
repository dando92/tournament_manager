import axios from "axios";
import { Entrant } from "@/features/entrant/types/Entrant";
import { PhaseGroup, PhaseGroupEntrant } from "@/features/division/types/Phase";

type CreatePhaseGroupRequest = {
  name?: string;
  displayIdentifier?: string;
  bracketType?: string;
};

export async function createPhaseGroup(phaseId: number, request: CreatePhaseGroupRequest): Promise<PhaseGroup> {
  const response = await axios.post<PhaseGroup>(`phases/${phaseId}/phase-groups`, request);
  return response.data;
}

export async function getPhaseGroup(phaseGroupId: number): Promise<PhaseGroup> {
  const response = await axios.get<PhaseGroup>(`phase-groups/${phaseGroupId}`);
  return response.data;
}

export async function listPhaseDivisionEntrants(phaseId: number): Promise<Entrant[]> {
  const response = await axios.get<Entrant[]>(`phases/${phaseId}/entrants`);
  return response.data;
}

export async function listPhaseGroupEntrants(phaseGroupId: number): Promise<PhaseGroupEntrant[]> {
  const response = await axios.get<PhaseGroupEntrant[]>(`phase-groups/${phaseGroupId}/entrants`);
  return response.data;
}

export async function updatePhaseGroupSeeding(phaseGroupId: number, entrantIds: number[]): Promise<void> {
  await axios.patch(`phase-groups/${phaseGroupId}/entrants/seeding`, { entrantIds });
}

export async function addEntrantToPhaseGroup(phaseGroupId: number, entrantId: number): Promise<void> {
  await axios.post(`phase-groups/${phaseGroupId}/entrants/${entrantId}`);
}

export async function removeEntrantFromPhaseGroup(phaseGroupId: number, entrantId: number): Promise<void> {
  await axios.delete(`phase-groups/${phaseGroupId}/entrants/${entrantId}`);
}

export async function deletePhaseGroup(phaseGroupId: number): Promise<void> {
  await axios.delete(`phase-groups/${phaseGroupId}`);
}
