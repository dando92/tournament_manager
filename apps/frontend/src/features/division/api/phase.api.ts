import axios from "axios";
import { Phase } from "@/features/division/model/types";

type UpdatePhaseRequest = {
  name?: string;
};

export async function createPhase(divisionId: number, name: string): Promise<Phase> {
  const response = await axios.post<Phase>("phases", { name, divisionId });
  return response.data;
}

export async function updatePhase(phaseId: number, request: UpdatePhaseRequest): Promise<Phase> {
  const response = await axios.patch<Phase>(`phases/${phaseId}`, request);
  return response.data;
}

export async function deletePhase(phaseId: number): Promise<void> {
  await axios.delete(`phases/${phaseId}`);
}
