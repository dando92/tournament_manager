import { useEffect, useMemo, useState } from "react";
import { Song } from "@/features/song/types/Song";
import { listSongs } from "@/features/song/api/song.api";

type UseAddEditSongToMatchModalOptions = {
  open: boolean;
  tournamentId?: number;
};

export function useAddEditSongToMatchModal({
  open,
  tournamentId,
}: UseAddEditSongToMatchModalOptions) {
  const [songAddType, setSongAddType] = useState<"title" | "roll">("title");
  const [difficultyInput, setDifficultyInput] = useState("");
  const [songs, setSongs] = useState<Song[]>([]);
  const [songGroups, setSongGroups] = useState<string[]>([]);
  const [selectedGroupName, setSelectedGroupName] = useState("");
  const [selectedSongs, setSelectedSongs] = useState<Song[]>([]);

  useEffect(() => {
    if (!open) return;
    listSongs(tournamentId)
      .then((catalog) => {
        setSongs(catalog);
        setSongGroups([...new Set(catalog.map((song) => song.group))]);
        setSelectedGroupName(catalog[0]?.group ?? "");
      })
      .catch(() => setSongs([]));
    setSongAddType("title");
    setSelectedSongs([]);
  }, [open, tournamentId]);

  const filteredSongs = useMemo(
    () =>
      songs.filter((song) => {
        const matchesGroup = !selectedGroupName || song.group === selectedGroupName;
        return matchesGroup;
      }),
    [selectedGroupName, songs],
  );

  useEffect(() => {
    setSelectedSongs((prev) => prev.filter((song) => filteredSongs.some((filteredSong) => filteredSong.id === song.id)));
  }, [filteredSongs]);

  return {
    songAddType,
    difficultyInput,
    songs,
    songGroups,
    selectedGroupName,
    selectedSongs,
    filteredSongs,
    setSongAddType,
    setDifficultyInput,
    setSelectedGroupName,
    setSelectedSongs,
  };
}
