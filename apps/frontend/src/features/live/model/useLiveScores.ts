import { useMemo } from "react";
import { LiveMatchStateDto } from "@tournament-manager/contracts";

export function useLiveScores(lobbyState: LiveMatchStateDto) {
  const sortedPlayers = useMemo(() => {
    return [...lobbyState.players].sort((a, b) => {
      if (a.isFailed && !b.isFailed) return 1;
      if (!a.isFailed && b.isFailed) return -1;
      if (a.exScore != null && b.exScore != null) return b.exScore - a.exScore;
      return (b.score ?? 0) - (a.score ?? 0);
    });
  }, [lobbyState]);

  const songTitle = useMemo(
    () => lobbyState.songTitle || lobbyState.songPath || "",
    [lobbyState.songPath, lobbyState.songTitle],
  );

  return {
    showJudgements: true,
    sortedPlayers,
    songTitle,
  };
}
