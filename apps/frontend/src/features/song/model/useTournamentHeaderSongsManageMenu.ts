import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { CreateSongRequest, Song } from "@/features/song/model/types";
import { createSong, listSongs } from "@/features/song/api/song.api";

type UseTournamentHeaderSongsManageMenuOptions = {
  tournamentId: number;
  songsVersion: number;
  refreshSongs: () => void;
};

export function useTournamentHeaderSongsManageMenu({
  tournamentId,
  songsVersion,
  refreshSongs,
}: UseTournamentHeaderSongsManageMenuOptions) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loadingSongsMeta, setLoadingSongsMeta] = useState(false);
  const [addInGroupOpen, setAddInGroupOpen] = useState(false);
  const [addInNewGroupOpen, setAddInNewGroupOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoadingSongsMeta(true);
    listSongs(tournamentId)
      .then(setSongs)
      .catch(() => {})
      .finally(() => setLoadingSongsMeta(false));
  }, [songsVersion, tournamentId]);

  const songGroups = useMemo(
    () => [...new Set(songs.map((song) => song.group))].sort(),
    [songs],
  );
  const selectedGroupName = songGroups[0] ?? "";

  const openMenu = () => setMenuOpen(true);
  const closeMenu = () => setMenuOpen(false);
  const openAddInGroup = () => {
    closeMenu();
    setAddInGroupOpen(true);
  };
  const openAddInNewGroup = () => {
    closeMenu();
    setAddInNewGroupOpen(true);
  };
  const triggerImport = () => {
    closeMenu();
    fileInputRef.current?.click();
  };

  const handleCreateSong = (
    title: string,
    difficulty: number,
    group: string,
    artist?: string,
  ) => {
    createSong(tournamentId, { title, artist, difficulty, group })
      .then(() => {
        refreshSongs();
        toast.success("Song created.");
      })
      .catch(() => {
        toast.error("Failed to create song.");
      });
  };

  const handleBulkImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data)) {
        toast.error("JSON must be an array of songs.");
        return;
      }

      const results = await Promise.allSettled(
        data.map((dto: CreateSongRequest) => createSong(tournamentId, dto)),
      );
      const created = results.filter((result) => result.status === "fulfilled").length;
      const failed = results.filter((result) => result.status === "rejected").length;
      refreshSongs();

      if (failed > 0) {
        toast.warn(`Imported ${created} songs. ${failed} failed.`);
        return;
      }

      toast.success(`Imported ${created} songs.`);
    } catch {
      toast.error("Failed to parse JSON file.");
    }
  };

  return {
    menuOpen,
    addInGroupOpen,
    addInNewGroupOpen,
    loadingSongsMeta,
    songGroups,
    selectedGroupName,
    fileInputRef,
    setAddInGroupOpen,
    setAddInNewGroupOpen,
    openMenu,
    closeMenu,
    openAddInGroup,
    openAddInNewGroup,
    triggerImport,
    handleCreateSong,
    handleBulkImport,
  };
}
