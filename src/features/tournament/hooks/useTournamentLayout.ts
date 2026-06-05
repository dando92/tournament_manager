import { useCallback, useMemo } from "react";
import { useLocation, useMatch, useNavigate } from "react-router-dom";
import { getTournamentHeaderSubtitle } from "@/features/tournament/components/header/tournamentHeaderSubtitle";
import { TournamentPageContextValue } from "@/features/tournament/context/TournamentPageContext";
import { GenerateBracketRequest, TournamentPageState } from "@/features/tournament/hooks/useTournamentPage";

type UseTournamentLayoutOptions = {
  context: TournamentPageContextValue;
  state: TournamentPageState;
};

export function useTournamentLayout({ context, state }: UseTournamentLayoutOptions) {
  const navigate = useNavigate();
  const location = useLocation();
  const divisionPhasesMatch = useMatch("/tournament/:tournamentId/division/:divisionId/phases");
  const divisionPhaseMatch = useMatch("/tournament/:tournamentId/division/:divisionId/phases/:phaseId");
  const { tournamentId, currentDivisionId } = context;
  const currentPhaseId = divisionPhaseMatch?.params.phaseId ? Number(divisionPhaseMatch.params.phaseId) : undefined;

  const routeState = useMemo(() => {
    const overviewPath = `/tournament/${tournamentId}/overview`;
    const lobbiesPath = `/tournament/${tournamentId}/lobbies`;
    const participantsPath = `/tournament/${tournamentId}/participants`;
    const songsPath = `/tournament/${tournamentId}/songs`;
    return {
      isOverviewPage: location.pathname === overviewPath,
      isLobbiesPage: location.pathname === lobbiesPath,
      isParticipantsPage: location.pathname === participantsPath,
      isSongsPage: location.pathname === songsPath,
      isDivisionPhasesPage: Boolean(divisionPhasesMatch || divisionPhaseMatch),
      currentDivisionId,
      currentPhaseId: currentPhaseId && Number.isFinite(currentPhaseId) ? currentPhaseId : undefined,
      headerSubtitle: getTournamentHeaderSubtitle(location.pathname, tournamentId),
    };
  }, [currentDivisionId, currentPhaseId, divisionPhaseMatch, divisionPhasesMatch, location.pathname, tournamentId]);

  const handleCreatePhase = useCallback(
    async (name: string, divisionId: number) => {
      await state.handleCreatePhase(name, divisionId);
      navigate(`/tournament/${tournamentId}/division/${divisionId}/phases?refresh=${Date.now()}`);
    },
    [navigate, state, tournamentId],
  );

  const handleGenerateBracket = useCallback(
    async (request: GenerateBracketRequest) => {
      const result = await state.handleGenerateBracket(request);
      navigate(`/tournament/${tournamentId}/division/${result.divisionId}/phases/${result.phaseId}?refresh=${Date.now()}`);
    },
    [navigate, state, tournamentId],
  );

  const handleCreatePhaseGroup = useCallback(
    async (name: string, phaseId: number) => {
      const result = await state.handleCreatePhaseGroup(name, phaseId);
      if (!result.divisionId) return;
      navigate(`/tournament/${tournamentId}/division/${result.divisionId}/phases/${result.phaseId}?refresh=${Date.now()}`);
    },
    [navigate, state, tournamentId],
  );

  return {
    ...routeState,
    handleCreatePhase,
    handleCreatePhaseGroup,
    handleGenerateBracket,
  };
}
