import type { Dispatch, SetStateAction } from "react";
import { useOutletContext } from "react-router-dom";
import { TournamentDivisionOption } from "@/features/tournament/types/TournamentDivisionOption";

export type ParticipantsManageModal =
  "none" | "register" | "database" | "import" | "startgg";

export type TournamentPageContextValue = {
  tournamentId: number;
  tournamentName: string;
  currentDivisionId?: number;
  syncstartUrl: string;
  hasStartggApiKey: boolean;
  tournamentStatus: "open" | "closed";
  songsVersion: number;
  divisions: TournamentDivisionOption[];
  controls: boolean;
  setTournamentName: Dispatch<SetStateAction<string>>;
  setSyncstartUrl: Dispatch<SetStateAction<string>>;
  setHasStartggApiKey: Dispatch<SetStateAction<boolean>>;
  setTournamentStatus: Dispatch<SetStateAction<"open" | "closed">>;
  refreshDivisions: () => Promise<void>;
  refreshSongs: () => void;
  openCreateDivision: () => void;
  openCreatePhase: () => void;
  participantsManageModal: ParticipantsManageModal;
  setParticipantsManageModal: Dispatch<SetStateAction<ParticipantsManageModal>>;
};

export function useTournamentPageContext() {
  return useOutletContext<TournamentPageContextValue>();
}
