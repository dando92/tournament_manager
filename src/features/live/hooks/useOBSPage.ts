import { useCallback, useMemo, useState } from "react";
import {
  ActiveLobbyDto,
  LiveMatchStateDto,
  useScoreHub,
} from "@/features/live/services/useScoreHub";

export function useOBSPage(lobbyId?: string) {
  const [liveMatchState, setLiveMatchState] = useState<LiveMatchStateDto | null>(null);

  const handleLiveMatchState = useCallback(
    (data: LiveMatchStateDto) => {
      if (data.lobbyId === lobbyId && data.players.length > 0) {
        setLiveMatchState(data);
      }
    },
    [lobbyId],
  );

  const handleLobbyDisconnected = useCallback(
    (data: ActiveLobbyDto) => {
      if (data.lobbyId === lobbyId && !data.isActive) {
        setLiveMatchState(null);
      }
    },
    [lobbyId],
  );

  const handlers = useMemo(
    () => ({
      onDisconnection: handleLobbyDisconnected,
      onGoingMatchUpdate: handleLiveMatchState,
      onSongCompleted: handleLiveMatchState,
    }),
    [handleLiveMatchState, handleLobbyDisconnected],
  );

  useScoreHub(handlers);

  return {
    lobbyState: liveMatchState,
  };
}
