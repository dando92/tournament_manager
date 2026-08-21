import axios from "axios";
import { Phase } from "@/features/division/types/Phase";

type UpdatePhaseRequest = {
  name?: string;
};

export async function updatePhase(phaseId: number, request: UpdatePhaseRequest): Promise<Phase> {
  const response = await axios.patch<Phase>(`phases/${phaseId}`, request);
  return response.data;
}
