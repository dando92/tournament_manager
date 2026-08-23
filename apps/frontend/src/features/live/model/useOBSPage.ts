import { useCallback, useMemo, useState } from "react";
import { LiveMatchStateDto } from "@tournament-manager/contracts";
import { useLiveMatchGateway } from "@/features/live/model/useLiveMatchGateway";

export function useOBSPage(lobbyId?: string, tournamentId?: number) {
  const [liveMatchState, setLiveMatchState] = useState<LiveMatchStateDto | null>(null);

  const handleSongSelected = useCallback(
    (data: LiveMatchStateDto) => {
      if (data.lobbyId === lobbyId) {
        setLiveMatchState(data);
      }
    },
    [lobbyId],
  );

  const handleLiveMatchState = useCallback(
    (data: LiveMatchStateDto) => {
      if (data.lobbyId === lobbyId) {
        setLiveMatchState(data);
      }
    },
    [lobbyId],
  );

  const handlers = useMemo(
    () => ({
      onSongSelected: handleSongSelected,
      onMatchUpdate: handleLiveMatchState,
      onSongCompleted: handleLiveMatchState,
      onRecover: () => setLiveMatchState(null),
    }),
    [handleLiveMatchState, handleSongSelected],
  );

  useLiveMatchGateway(tournamentId ?? null, handlers);

  return {
    lobbyState: liveMatchState,
  };
}
