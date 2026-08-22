import { useEffect, useMemo, useState } from "react";
import { Song } from "@/features/song/types/Song";
import { deleteSong, listSongs } from "@/features/song/api/song.api";

type Params = {
  tournamentId?: number;
  songsVersion: number;
};

export function useSongsList({ tournamentId, songsVersion }: Params) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [packFilter, setPackFilter] = useState("");
  const [songSearch, setSongSearch] = useState("");

  useEffect(() => {
    listSongs(tournamentId)
      .then((catalog) => {
        setSongs(catalog);
        setGroups([...new Set(catalog.map((song) => song.group))].sort());
      })
      .catch(() => {});
  }, [songsVersion, tournamentId]);

  const packOptions = useMemo(() => groups, [groups]);

  async function handleDeleteSong(id: number) {
    await deleteSong(id);
    setSongs((prev) => {
      const merged = prev.filter((song) => song.id !== id);
      setGroups([...new Set(merged.map((song) => song.group))].sort());
      return merged;
    });
  }

  async function handleDeletePack(pack: string) {
    const packSongs = songs.filter((song) => song.group === pack);
    await Promise.allSettled(packSongs.map((song) => deleteSong(song.id)));
    setSongs((prev) => {
      const merged = prev.filter((song) => song.group !== pack);
      setGroups([...new Set(merged.map((song) => song.group))].sort());
      return merged;
    });
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
