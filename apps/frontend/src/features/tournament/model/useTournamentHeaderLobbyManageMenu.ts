import { useState } from "react";
import { toast } from "react-toastify";
import { createLobby } from "@/features/tournament/api/lobbies.api";

type UseTournamentHeaderLobbyManageMenuOptions = {
  tournamentId: number;
  canCreateLobby: boolean;
};

export function useTournamentHeaderLobbyManageMenu({
  tournamentId,
  canCreateLobby,
}: UseTournamentHeaderLobbyManageMenuOptions) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [createLobbyModalOpen, setCreateLobbyModalOpen] = useState(false);
  const [createLobbyName, setCreateLobbyName] = useState("");
  const [createLobbyPassword, setCreateLobbyPassword] = useState("");

  const closeMenu = () => setMenuOpen(false);
  const toggleMenu = () => setMenuOpen((value) => !value);
  const openCreateLobbyModal = () => {
    if (!canCreateLobby) {
      toast.error("Connect to SyncStart before creating a lobby.");
      return;
    }
    closeMenu();
    setCreateLobbyModalOpen(true);
  };

  /* The lobby joins the list on the page behind, so nothing is announced; the
     dialog holds the spinner, the failure, and its own closing. */
  const handleCreateLobby = async () => {
    await createLobby(tournamentId, {
      name: createLobbyName.trim() || undefined,
      password: createLobbyPassword,
    });
    setCreateLobbyName("");
    setCreateLobbyPassword("");
  };

  return {
    menuOpen,
    createLobbyModalOpen,
    createLobbyName,
    createLobbyPassword,
    setCreateLobbyModalOpen,
    setCreateLobbyName,
    setCreateLobbyPassword,
    toggleMenu,
    closeMenu,
    openCreateLobbyModal,
    handleCreateLobby,
  };
}
