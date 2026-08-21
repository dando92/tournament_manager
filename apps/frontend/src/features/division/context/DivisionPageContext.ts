import { useOutletContext } from "react-router-dom";
import { Division } from "@/features/division/types/Division";

export type DivisionPageContextValue = {
  division: Division;
  tournamentId: number;
  divisionId: number;
  controls: boolean;
  refreshDivision: () => Promise<void>;
};

export function useDivisionPageContext() {
  return useOutletContext<DivisionPageContextValue>();
}
