import axios from "axios";
import { PhaseGroup, PhaseGroupAdvancementRuleInput } from "@/features/division/types/Phase";

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

export async function generatePhaseGroupBracket(
  phaseGroupId: number,
  bracketType: string,
  playerPerMatch: number,
): Promise<void> {
  await axios.post(`phase-groups/${phaseGroupId}/generate-bracket`, { bracketType, playerPerMatch });
}
