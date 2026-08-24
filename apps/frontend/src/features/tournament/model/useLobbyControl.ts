import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  getLobbyControlOptions,
  lobbyControlKeys,
  selectLobbySong,
  startLobbySong,
} from "@/features/tournament/api/lobbies.api";

export function useLobbyControl(tournamentId: number) {
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
    onSuccess: () => toast.success("Song selection sent to the lobby."),
    onError: (error) => toast.error(commandError(error, "Unable to select the song.")),
  });

  const startSong = useMutation({
    mutationFn: async () => {
      if (!lobbyId || songId === null) throw new Error("Select a lobby and song first.");
      await startLobbySong(tournamentId, lobbyId, songId);
    },
    onSuccess: () => toast.success("Start sent to the lobby."),
    onError: (error) => toast.error(commandError(error, "Unable to start the cabinets.")),
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

function commandError(error: unknown, fallback: string): string {
  return (error as { response?: { data?: { message?: string } } })?.response?.data?.message
    ?? (error instanceof Error ? error.message : fallback);
}
