import { useOutletContext } from "react-router-dom";
import { Division } from "@/features/division/model/types";
import { Entrant } from "@/features/participant/model/types";

export type DivisionPageContextValue = {
  division: Division;
  /** The roster, read apart from the structure because it is a list of people rather than a count. */
  entrants: Entrant[];
  tournamentId: number;
  divisionId: number;
  controls: boolean;
  /** For the advancement rules alone: every other write to a division announces itself. */
  refreshDivision: () => Promise<void>;
};

export function useDivisionPageContext() {
  return useOutletContext<DivisionPageContextValue>();
}
