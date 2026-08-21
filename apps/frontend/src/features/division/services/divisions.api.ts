import axios from "axios";
import { Entrant } from "@/features/entrant/types/Entrant";

export async function listDivisionEntrants(divisionId: number): Promise<Entrant[]> {
  const response = await axios.get<Entrant[]>(`divisions/${divisionId}/entrants`);
  return response.data;
}

export async function updateDivisionSeeding(divisionId: number, entrantIds: number[]): Promise<void> {
  await axios.patch(`divisions/${divisionId}/entrants/seeding`, { entrantIds });
}
