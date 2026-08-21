import axios from "axios";
import { Entrant } from "@/features/entrant/types/Entrant";

export async function listDivisionEntrants(divisionId: number): Promise<Entrant[]> {
  const response = await axios.get<Entrant[]>(`divisions/${divisionId}/entrants`);
  return response.data;
}
