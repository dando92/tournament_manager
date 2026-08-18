import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Song } from "@/features/song/types/Song";

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
    const url = tournamentId ? `songs?tournamentId=${tournamentId}` : "songs";
    axios.get<Song[]>(url).then((response) => {
      const { data } = response;
      setSongs(data);
      setGroups([...new Set(data.map((song) => song.group))].sort());
    });
  }, [songsVersion, tournamentId]);

  const packOptions = useMemo(() => groups, [groups]);

  async function handleDeleteSong(id: number) {
    await axios.delete(`songs/${id}`);
    setSongs((prev) => {
      const merged = prev.filter((song) => song.id !== id);
      setGroups([...new Set(merged.map((song) => song.group))].sort());
      return merged;
    });
  }

  async function handleDeletePack(pack: string) {
    const packSongs = songs.filter((song) => song.group === pack);
    await Promise.allSettled(packSongs.map((song) => axios.delete(`songs/${song.id}`)));
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
