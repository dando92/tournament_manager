import axios from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { ActiveLobbyDto, LobbyCardStateDto, SyncStartConnectionStatusDto } from "@/features/live/services/useScoreHub";

export type TournamentLobbyStatusDto = {
  id: string;
  name: string;
  lobbyCode: string;
  isPasswordProtected: boolean;
  playerCount: number;
  spectatorCount: number;
};

type TournamentLobbiesDto = {
  status: {
    isActive: boolean;
    isConnected: boolean;
  };
  lobbies: TournamentLobbyStatusDto[];
};

type Params = {
  tournamentId: number;
  activeLobbies: ReadonlyMap<string, ActiveLobbyDto>;
  syncStartConnectionStatus: SyncStartConnectionStatusDto;
  lobbyCardStates: ReadonlyMap<string, LobbyCardStateDto>;
};

type SpectateModalState = {
  open: boolean;
  lobbyCode: string;
  lobbyName: string;
  password: string;
};

const closedSpectateModal: SpectateModalState = {
  open: false,
  lobbyCode: "",
  lobbyName: "",
  password: "",
};

export function useTournamentLobbiesPage({
  tournamentId,
  activeLobbies,
  syncStartConnectionStatus,
  lobbyCardStates,
}: Params) {
  const [availableLobbies, setAvailableLobbies] = useState<TournamentLobbyStatusDto[]>([]);
  const [serverConnectionStatus, setServerConnectionStatus] = useState({ isActive: false, isConnected: false });
  const [connectingServer, setConnectingServer] = useState(false);
  const [disconnectingServer, setDisconnectingServer] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [spectating, setSpectating] = useState(false);
  const [spectateModal, setSpectateModal] = useState<SpectateModalState>(closedSpectateModal);

  const refreshLobbies = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await axios.get<TournamentLobbiesDto>(`tournaments/${tournamentId}/lobbies`);
      setAvailableLobbies(response.data.lobbies);
      setServerConnectionStatus(response.data.status);
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to refresh lobbies.";
      toast.error(message);
    } finally {
      setRefreshing(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    if (syncStartConnectionStatus.tournamentId !== tournamentId) return;
    setServerConnectionStatus({
      isActive: syncStartConnectionStatus.isActive,
      isConnected: syncStartConnectionStatus.isConnected,
    });
  }, [syncStartConnectionStatus, tournamentId]);

  const liveConnectionStatus = useMemo(() => {
    return serverConnectionStatus;
  }, [serverConnectionStatus]);

  useEffect(() => {
    refreshLobbies().catch(() => {});
  }, [refreshLobbies]);

  const lobbies = useMemo(() => {
    const merged = new Map<string, TournamentLobbyStatusDto>();

    for (const lobby of availableLobbies) {
      merged.set(lobby.lobbyCode, lobby);
    }

    for (const lobby of activeLobbies.values()) {
      if (lobby.tournamentId !== tournamentId) continue;
      const existing = merged.get(lobby.lobbyCode);
      merged.set(lobby.lobbyCode, {
        id: lobby.lobbyId,
        name: lobby.lobbyName,
        lobbyCode: lobby.lobbyCode,
        isPasswordProtected: existing?.isPasswordProtected ?? false,
        playerCount: existing?.playerCount ?? 0,
        spectatorCount: existing?.spectatorCount ?? 0,
      });
    }

    return Array.from(merged.values())
      .sort((a, b) => a.lobbyCode.localeCompare(b.lobbyCode))
      .map((lobby) => ({
        lobby: {
          lobbyId: lobby.id,
          lobbyName: lobby.name,
          lobbyCode: lobby.lobbyCode,
          isSpectated: Array.from(activeLobbies.values()).some(
            (activeLobby) =>
              activeLobby.tournamentId === tournamentId &&
              activeLobby.lobbyCode === lobby.lobbyCode &&
              activeLobby.isActive,
          ),
          isPasswordProtected: lobby.isPasswordProtected,
          playerCount: lobby.playerCount,
          spectatorCount: lobby.spectatorCount,
        },
        lobbyState: lobbyCardStates.get(lobby.lobbyCode),
      }));
  }, [activeLobbies, availableLobbies, lobbyCardStates, tournamentId]);

  function openSpectateModal(lobbyCode: string) {
    setSpectateModal({
      open: true,
      lobbyCode,
      lobbyName: lobbyCode,
      password: "",
    });
  }

  function closeSpectateModal() {
    if (spectating) return;
    setSpectateModal(closedSpectateModal);
  }

  async function handleConnectServer() {
    setConnectingServer(true);
    try {
      const response = await axios.post<{ isActive: boolean; isConnected: boolean }>(
        `tournaments/${tournamentId}/lobbies/server/connect`,
      );
      setServerConnectionStatus(response.data);
      toast.success("Connected to SyncStart.");
      if (response.data.isConnected) {
        refreshLobbies().catch(() => {});
      }
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to connect to SyncStart.";
      toast.error(message);
    } finally {
      setConnectingServer(false);
    }
  }

  async function handleDisconnectServer() {
    setDisconnectingServer(true);
    try {
      const response = await axios.delete<{ isActive: boolean; isConnected: boolean }>(
        `tournaments/${tournamentId}/lobbies/server/disconnect`,
      );
      setServerConnectionStatus(response.data);
      toast.success("Disconnected from SyncStart.");
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to disconnect from SyncStart.";
      toast.error(message);
    } finally {
      setDisconnectingServer(false);
    }
  }

  async function handleSpectateLobby() {
    if (!spectateModal.lobbyCode.trim()) {
      toast.error("Lobby code is required.");
      return;
    }

    setSpectating(true);
    try {
      await axios.post(`tournaments/${tournamentId}/lobbies/connect`, {
        name: spectateModal.lobbyName.trim() || spectateModal.lobbyCode.trim().toUpperCase(),
        lobbyCode: spectateModal.lobbyCode.trim().toUpperCase(),
        password: spectateModal.password,
      });
      setSpectateModal(closedSpectateModal);
      toast.success("Spectating lobby.");
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to spectate lobby.";
      toast.error(message);
    } finally {
      setSpectating(false);
      refreshLobbies().catch(() => {});
    }
  }

  async function handleDisconnectLobby(lobbyId: string) {
    try {
      await axios.delete(`tournaments/${tournamentId}/lobbies/${lobbyId}/disconnect`);
      toast.success("Lobby disconnected.");
    } catch {
      toast.error("Failed to disconnect lobby.");
    } finally {
      refreshLobbies().catch(() => {});
    }
  }

  return {
    lobbies,
    connectionStatus: liveConnectionStatus,
    connectingServer,
    disconnectingServer,
    handleConnectServer,
    handleDisconnectServer,
    refreshing,
    refreshLobbies,
    spectateModal,
    setSpectateModal,
    spectating,
    openSpectateModal,
    closeSpectateModal,
    handleSpectateLobby,
    handleDisconnectLobby,
  };
}
