import axios from "axios";

type UpdatePhaseRequest = {
  name?: string;
};

/**
 * The phases of a division.
 *
 * A creation answers with the id of what it made; the other two answer nothing
 * at all. What they changed reaches the tree through the event the server
 * publishes, so no caller here applies a result of its own.
 */
export async function createPhase(divisionId: number, name: string): Promise<number> {
  const response = await axios.post<{ id: number }>("phases", { name, divisionId });
  return response.data.id;
}

export async function updatePhase(phaseId: number, request: UpdatePhaseRequest): Promise<void> {
  await axios.patch(`phases/${phaseId}`, request);
}

export async function deletePhase(phaseId: number): Promise<void> {
  await axios.delete(`phases/${phaseId}`);
}
