import axios from "axios";
import { PhaseGroup } from "@/features/division/model/types";

type CreatePhaseGroupRequest = {
  name?: string;
  displayIdentifier?: string;
  bracketType?: string;
};

type UpdatePhaseGroupRequest = {
  name?: string;
  displayIdentifier?: string;
  bracketType?: string;
};

export async function createPhaseGroup(phaseId: number, request: CreatePhaseGroupRequest): Promise<PhaseGroup> {
  const response = await axios.post<PhaseGroup>(`phases/${phaseId}/phase-groups`, request);
  return response.data;
}

export async function updatePhaseGroup(phaseGroupId: number, request: UpdatePhaseGroupRequest): Promise<PhaseGroup> {
  const response = await axios.patch<PhaseGroup>(`phase-groups/${phaseGroupId}`, request);
  return response.data;
}

export async function deletePhaseGroup(phaseGroupId: number): Promise<void> {
  await axios.delete(`phase-groups/${phaseGroupId}`);
}
