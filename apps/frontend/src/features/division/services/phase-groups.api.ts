import axios from "axios";
import { PhaseGroup } from "@/features/division/types/Phase";

type CreatePhaseGroupRequest = {
  name?: string;
  displayIdentifier?: string;
  bracketType?: string;
};

export async function createPhaseGroup(phaseId: number, request: CreatePhaseGroupRequest): Promise<PhaseGroup> {
  const response = await axios.post<PhaseGroup>(`phases/${phaseId}/phase-groups`, request);
  return response.data;
}

export async function deletePhaseGroup(phaseGroupId: number): Promise<void> {
  await axios.delete(`phase-groups/${phaseGroupId}`);
}
