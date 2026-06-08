import { useCallback, useMemo, useState } from "react";
import {
  LiveMatchStateDto,
} from "@/features/live/services/syncstartGatewayDtos";
import { useLiveMatchGateway } from "@/features/live/services/useLiveMatchGateway";

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
    }),
    [handleLiveMatchState, handleSongSelected],
  );

  useLiveMatchGateway(tournamentId ?? null, handlers);

  return {
    lobbyState: liveMatchState,
  };
}
