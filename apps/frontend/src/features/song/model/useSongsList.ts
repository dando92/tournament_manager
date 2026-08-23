import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Song } from "@/features/song/model/types";
import { deleteSong, listSongs } from "@/features/song/api/song.api";
import { songKeys } from "@/features/song/api/song.keys";

type Params = {
  tournamentId?: number;
};

const noSongs: Song[] = [];

export function useSongsList({ tournamentId }: Params) {
  const [packFilter, setPackFilter] = useState("");
  const [songSearch, setSongSearch] = useState("");
  const songsQuery = useQuery({
    queryKey: songKeys.forTournament(tournamentId),
    queryFn: () => listSongs(tournamentId),
  });
  const deleteMutation = useMutation({ mutationFn: deleteSong });
  const songs = songsQuery.data ?? noSongs;
  const packOptions = useMemo(
    () => [...new Set(songs.map((song) => song.group))].sort(),
    [songs],
  );

  async function handleDeleteSong(id: number) {
    await deleteMutation.mutateAsync(id);
  }

  async function handleDeletePack(pack: string) {
    const packSongs = songs.filter((song) => song.group === pack);
    await Promise.allSettled(
      packSongs.map((song) => deleteMutation.mutateAsync(song.id)),
    );
  }

  return {
    songs,
    packFilter,
    songSearch,
    packOptions,
    setPackFilter,
    setSongSearch,
    handleDeleteSong,
    handleDeletePack,
  };
}
