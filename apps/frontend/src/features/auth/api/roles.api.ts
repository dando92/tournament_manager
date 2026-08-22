import axios from "axios";
import type { MyTournamentRolesDto } from "@tournament-manager/contracts";

/**
 * What the signed-in account may do, as the server sees it.
 *
 * One request answers for every tournament at once, which is why the permission
 * context loads it per token rather than per page.
 */
export async function getMyTournamentRoles(): Promise<MyTournamentRolesDto> {
  const response = await axios.get<MyTournamentRolesDto>("tournaments/my-roles");
  return response.data;
}
