import { useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";

type UseTournamentHeaderLobbyManageMenuOptions = {
  tournamentId: number;
};

export function useTournamentHeaderLobbyManageMenu({
  tournamentId,
}: UseTournamentHeaderLobbyManageMenuOptions) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [createLobbyModalOpen, setCreateLobbyModalOpen] = useState(false);
  const [creatingLobby, setCreatingLobby] = useState(false);
  const [createLobbyName, setCreateLobbyName] = useState("");
  const [createLobbyPassword, setCreateLobbyPassword] = useState("");

  const closeMenu = () => setMenuOpen(false);
  const toggleMenu = () => setMenuOpen((value) => !value);
  const openCreateLobbyModal = () => {
    closeMenu();
    setCreateLobbyModalOpen(true);
  };

  const handleCreateLobby = async () => {
    setCreatingLobby(true);
    try {
      await axios.post(`tournaments/${tournamentId}/lobbies/create`, {
        name: createLobbyName.trim() || undefined,
        password: createLobbyPassword,
      });
      setCreateLobbyName("");
      setCreateLobbyPassword("");
      setCreateLobbyModalOpen(false);
      toast.success("Lobby created.");
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to create lobby.";
      toast.error(message);
    } finally {
      setCreatingLobby(false);
    }
  };

  return {
    menuOpen,
    createLobbyModalOpen,
    creatingLobby,
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
