import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { Song } from "@/features/song/model/types";
import { createSong, listSongs } from "@/features/song/api/song.api";
import { useSongImport } from "@/features/song/model/useSongImport";

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
  const songImport = useSongImport({ tournamentId, refreshSongs });

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

  /**
   * The import is the person choosing a folder, so it starts in the click that
   * asked for it: a directory picker only opens from a gesture.
   */
  const triggerImport = () => {
    closeMenu();
    void songImport.start();
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

  return {
    menuOpen,
    addInGroupOpen,
    addInNewGroupOpen,
    loadingSongsMeta,
    songGroups,
    selectedGroupName,
    songImport,
    setAddInGroupOpen,
    setAddInNewGroupOpen,
    openMenu,
    closeMenu,
    openAddInGroup,
    openAddInNewGroup,
    triggerImport,
    handleCreateSong,
  };
}
