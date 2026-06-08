import { useMemo } from "react";
import { useTournamentUpdates } from "@/features/tournament/context/TournamentUpdatesContext";

export function useLivePhase(tournamentId: number) {
  const { activeLobbies, liveMatchStates } = useTournamentUpdates();

  const tournamentActiveLobbies = useMemo(
    () =>
      Array.from(activeLobbies.values()).filter(
        (lobby) => lobby.tournamentId === tournamentId,
      ),
    [activeLobbies, tournamentId],
  );

  const tournamentLiveStates = useMemo(
    () =>
      Array.from(liveMatchStates.values()).filter(
        (state) => state.tournamentId === tournamentId,
      ),
    [liveMatchStates, tournamentId],
  );

  const pendingLobbies = useMemo(
    () =>
      tournamentActiveLobbies.filter(
        (lobby) => !liveMatchStates.has(lobby.lobbyId),
      ),
    [liveMatchStates, tournamentActiveLobbies],
  );

  return {
    tournamentActiveLobbies,
    tournamentLiveStates,
    pendingLobbies,
  };
}
