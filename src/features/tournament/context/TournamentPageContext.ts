import type { Dispatch, SetStateAction } from "react";
import { useOutletContext } from "react-router-dom";
import { TournamentDivisionOption } from "@/features/tournament/types/TournamentDivisionOption";

export type ParticipantsManageModal = "none" | "register" | "database" | "import" | "startgg";

export type TournamentPageContextValue = {
  tournamentId: number;
  tournamentName: string;
  currentDivisionId?: number;
  syncstartUrl: string;
  songsVersion: number;
  divisions: TournamentDivisionOption[];
  controls: boolean;
  setSyncstartUrl: Dispatch<SetStateAction<string>>;
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
