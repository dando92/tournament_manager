import { useMemo, useState } from "react";
import { LiveMatchStateDto } from "@/features/live/model/types";
import { useLiveMatchGateway } from "@/features/live/model/useLiveMatchGateway";

export function useLivePhase(tournamentId: number) {
  const [liveMatchStates, setLiveMatchStates] = useState<ReadonlyMap<string, LiveMatchStateDto>>(new Map());

  useLiveMatchGateway(tournamentId, {
    onSongSelected: (data) => {
      if (data.tournamentId !== tournamentId) return;
      setLiveMatchStates((prev) => new Map(prev).set(data.lobbyId, data));
    },
    onMatchUpdate: (data) => {
      if (data.tournamentId !== tournamentId) return;
      setLiveMatchStates((prev) => new Map(prev).set(data.lobbyId, data));
    },
    onSongCompleted: (data) => {
      if (data.tournamentId !== tournamentId) return;
      setLiveMatchStates((prev) => new Map(prev).set(data.lobbyId, data));
    },
    onRecover: () => setLiveMatchStates(new Map()),
  });

  const tournamentLiveStates = useMemo(
    () =>
      Array.from(liveMatchStates.values()).filter(
        (state) => state.tournamentId === tournamentId,
      ),
    [liveMatchStates, tournamentId],
  );

  return {
    tournamentLiveStates,
  };
}
