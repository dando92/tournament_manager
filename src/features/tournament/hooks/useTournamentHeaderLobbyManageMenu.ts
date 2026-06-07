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
  const [connectLobbyModalOpen, setConnectLobbyModalOpen] = useState(false);
  const [creatingLobby, setCreatingLobby] = useState(false);
  const [connectingLobby, setConnectingLobby] = useState(false);
  const [createLobbyName, setCreateLobbyName] = useState("");
  const [createLobbyPassword, setCreateLobbyPassword] = useState("");
  const [connectLobbyName, setConnectLobbyName] = useState("");
  const [connectLobbyCode, setConnectLobbyCode] = useState("");
  const [connectLobbyPassword, setConnectLobbyPassword] = useState("");

  const closeMenu = () => setMenuOpen(false);
  const toggleMenu = () => setMenuOpen((value) => !value);
  const openCreateLobbyModal = () => {
    closeMenu();
    setCreateLobbyModalOpen(true);
  };
  const openConnectLobbyModal = () => {
    closeMenu();
    setConnectLobbyModalOpen(true);
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

  const handleConnectLobby = async () => {
    if (!connectLobbyCode.trim()) {
      toast.error("Lobby code is required.");
      return;
    }

    setConnectingLobby(true);
    try {
      await axios.post(`tournaments/${tournamentId}/lobbies/connect`, {
        name: connectLobbyName.trim() || connectLobbyCode.trim().toUpperCase(),
        lobbyCode: connectLobbyCode.trim().toUpperCase(),
        password: connectLobbyPassword,
      });
      setConnectLobbyName("");
      setConnectLobbyCode("");
      setConnectLobbyPassword("");
      setConnectLobbyModalOpen(false);
      toast.success("Connected to lobby.");
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to connect to lobby.";
      toast.error(message);
    } finally {
      setConnectingLobby(false);
    }
  };

  return {
    menuOpen,
    createLobbyModalOpen,
    connectLobbyModalOpen,
    creatingLobby,
    connectingLobby,
    createLobbyName,
    createLobbyPassword,
    connectLobbyName,
    connectLobbyCode,
    connectLobbyPassword,
    setCreateLobbyModalOpen,
    setConnectLobbyModalOpen,
    setCreateLobbyName,
    setCreateLobbyPassword,
    setConnectLobbyName,
    setConnectLobbyCode,
    setConnectLobbyPassword,
    toggleMenu,
    closeMenu,
    openCreateLobbyModal,
    openConnectLobbyModal,
    handleCreateLobby,
    handleConnectLobby,
  };
}
