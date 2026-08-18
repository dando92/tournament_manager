import { useState } from "react";
import { useMatch } from "react-router-dom";
import { usePermissions } from "@/shared/services/permissions/PermissionContext";
import {
  ParticipantsManageModal,
  TournamentPageContextValue,
} from "@/features/tournament/context/TournamentPageContext";
import { useTournamentPage } from "@/features/tournament/hooks/useTournamentPage";

export function useTournamentPageContainer(tournamentId: number) {
  const divisionMatch = useMatch(
    "/tournament/:tournamentId/division/:divisionId/*",
  );
  const { canEditTournament } = usePermissions();
  const canControl = canEditTournament(tournamentId);
  const state = useTournamentPage({ tournamentId, canControl });
  const [songsVersion, setSongsVersion] = useState(0);
  const [participantsManageModal, setParticipantsManageModal] =
    useState<ParticipantsManageModal>("none");
  const parsedDivisionId = divisionMatch?.params.divisionId
    ? Number(divisionMatch.params.divisionId)
    : undefined;
  const currentDivisionId =
    parsedDivisionId && Number.isFinite(parsedDivisionId)
      ? parsedDivisionId
      : undefined;

  const context: TournamentPageContextValue = {
    tournamentId,
    tournamentName: state.tournamentName,
    currentDivisionId,
    syncstartUrl: state.syncstartUrl,
    hasStartggApiKey: state.hasStartggApiKey,
    tournamentStatus: state.tournamentStatus,
    songsVersion,
    divisions: state.divisions,
    controls: canControl && state.tournamentStatus === "open",
    setTournamentName: state.setTournamentName,
    setSyncstartUrl: state.setSyncstartUrl,
    setHasStartggApiKey: state.setHasStartggApiKey,
    setTournamentStatus: state.setTournamentStatus,
    refreshDivisions: state.refreshDivisions,
    refreshSongs: () => setSongsVersion((value) => value + 1),
    openCreateDivision: () => state.setCreateDivisionOpen(true),
    openCreatePhase: () => state.setCreatePhaseOpen(true),
    participantsManageModal,
    setParticipantsManageModal,
  };

  return {
    context,
    state,
  };
}
