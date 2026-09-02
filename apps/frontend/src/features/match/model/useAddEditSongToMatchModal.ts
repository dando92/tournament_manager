import { useEffect, useMemo, useState } from "react";
import { Song } from "@/features/song/model/types";
import { listSongs } from "@/features/song/api/song.api";
import { useSongRoll } from "@/features/song/model/useSongRoll";

type UseAddEditSongToMatchModalOptions = {
  open: boolean;
  tournamentId?: number;
  /** The pool a draw reaches: the division this match is played in. */
  divisionId?: number;
  /** The match itself, whose songs a draw may never offer twice. */
  matchId?: number;
};

export function useAddEditSongToMatchModal({
  open,
  tournamentId,
  divisionId,
  matchId,
}: UseAddEditSongToMatchModalOptions) {
  const [songAddType, setSongAddType] = useState<"title" | "roll">("title");
  const [songs, setSongs] = useState<Song[]>([]);
  const [songGroups, setSongGroups] = useState<string[]>([]);
  const [selectedGroupName, setSelectedGroupName] = useState("");
  const [selectedSongs, setSelectedSongs] = useState<Song[]>([]);
  const roll = useSongRoll({ open, divisionId, matchId, tournamentId });

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
    songs,
    songGroups,
    selectedGroupName,
    selectedSongs,
    filteredSongs,
    roll,
    setSongAddType,
    setSelectedGroupName,
    setSelectedSongs,
  };
}
