import axios from "axios";
import { PhaseGroup, PhaseGroupAdvancementRuleInput } from "@/features/division/types/Phase";

type CreatePhaseGroupRequest = {
  name: string;
  displayIdentifier?: string;
  bracketType?: string;
};

export async function createPhaseGroup(phaseId: number, request: CreatePhaseGroupRequest): Promise<PhaseGroup> {
  const response = await axios.post<PhaseGroup>(`phases/${phaseId}/phase-groups`, request);
  return response.data;
}

export async function updatePhaseGroupSeeding(phaseGroupId: number, entrantIds: number[]): Promise<void> {
  await axios.patch(`phase-groups/${phaseGroupId}/entrants/seeding`, { entrantIds });
}

export async function updatePhaseGroupAdvancementRules(
  phaseGroupId: number,
  rules: PhaseGroupAdvancementRuleInput[],
): Promise<PhaseGroup> {
  const response = await axios.put<PhaseGroup>(`phase-groups/${phaseGroupId}/advancement-rules`, { rules });
  return response.data;
}

export async function deletePhaseGroup(phaseGroupId: number): Promise<void> {
  await axios.delete(`phase-groups/${phaseGroupId}`);
}
