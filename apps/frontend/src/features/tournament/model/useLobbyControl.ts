import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  getLobbyControlOptions,
  lobbyControlKeys,
  selectLobbySong,
  startLobbySong,
} from "@/features/tournament/api/lobbies.api";
import { usePageNotices } from "@/shared/context/PageNoticeContext";
import { apiErrorDetail } from "@/shared/lib/apiError";

const SELECT_FAILED = "Unable to select the song.";
const START_FAILED = "Unable to start the cabinets.";

export function useLobbyControl(tournamentId: number) {
  const { report, dismiss } = usePageNotices();
  const options = useQuery({
    queryKey: lobbyControlKeys.options(tournamentId),
    queryFn: () => getLobbyControlOptions(tournamentId),
  });
  const [lobbyId, setLobbyId] = useState("");
  const [songId, setSongId] = useState<number | null>(null);

  useEffect(() => {
    const lobbies = options.data?.lobbies ?? [];
    if (!lobbies.some((lobby) => lobby.id === lobbyId)) setLobbyId(lobbies[0]?.id ?? "");
  }, [lobbyId, options.data?.lobbies]);

  useEffect(() => {
    const songs = options.data?.songs ?? [];
    if (!songs.some((song) => song.id === songId)) setSongId(songs[0]?.id ?? null);
  }, [options.data?.songs, songId]);

  const selectSong = useMutation({
    mutationFn: async () => {
      if (!lobbyId || songId === null) throw new Error("Select a lobby and song first.");
      await selectLobbySong(tournamentId, lobbyId, songId);
    },
    onSuccess: () => dismiss(SELECT_FAILED),
    onError: (error) => report(SELECT_FAILED, { detail: commandDetail(error) }),
  });

  const startSong = useMutation({
    mutationFn: async () => {
      if (!lobbyId || songId === null) throw new Error("Select a lobby and song first.");
      await startLobbySong(tournamentId, lobbyId, songId);
    },
    onSuccess: () => dismiss(START_FAILED),
    onError: (error) => report(START_FAILED, { detail: commandDetail(error) }),
  });

  return {
    options,
    lobbyId,
    songId,
    setLobbyId,
    setSongId,
    selectSong: () => selectSong.mutateAsync(),
    startSong: () => startSong.mutateAsync(),
    selecting: selectSong.isPending,
    starting: startSong.isPending,
  };
}

/* A command refused before it left — no lobby, no song — says so in the error
   it threw; anything further down says it in the response body. */
function commandDetail(error: unknown): string | undefined {
  return apiErrorDetail(error) ?? (error instanceof Error ? error.message : undefined);
}
