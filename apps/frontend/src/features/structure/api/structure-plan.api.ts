import axios from "axios";
import type { StructurePlan, StructurePlanAppliedDto } from "@tournament-manager/contracts";

/**
 * Writing a plan.
 *
 * One route for everything that changes the shape of a tournament, whether the
 * plan came from a dashed slot somebody typed into, from the generator, or from
 * an import. It answers with the row each local id became, which is how the
 * caller navigates into what it just made.
 */
export async function applyStructurePlan(tournamentId: number, plan: StructurePlan): Promise<StructurePlanAppliedDto> {
  const response = await axios.post<StructurePlanAppliedDto>(`tournaments/${tournamentId}/structure/plans`, plan);

  return response.data;
}
