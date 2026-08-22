import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import type { SyncStartLobbyStatusDto } from "@tournament-manager/contracts";
import {
  ActiveLobbyDto,
  LobbyCardStateDto,
  LobbyPlayerReadyDto,
  LobbySongSelectedDto,
  SyncStartConnectionStatusDto,
} from "@/features/live/model/types";
import { useLobbyGateway } from "@/features/tournament/model/useLobbyGateway";
import {
  connectLobbyServer,
  disconnectLobby,
  disconnectLobbyServer,
  listTournamentLobbies,
  spectateLobby,
} from "@/features/tournament/api/lobbies.api";

type Params = {
  tournamentId: number;
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
}: Params) {
  const [activeLobbies, setActiveLobbies] = useState<ReadonlyMap<string, ActiveLobbyDto>>(new Map());
  const [syncStartConnectionStatus, setSyncStartConnectionStatus] = useState<SyncStartConnectionStatusDto>({
    tournamentId,
    isActive: false,
    isConnected: false,
  });
  const [lobbyCardStates, setLobbyCardStates] = useState<ReadonlyMap<string, LobbyCardStateDto>>(new Map());
  const [availableLobbies, setAvailableLobbies] = useState<SyncStartLobbyStatusDto[]>([]);
  const [serverConnectionStatus, setServerConnectionStatus] = useState({ isActive: false, isConnected: false });
  const [connectingServer, setConnectingServer] = useState(false);
  const [disconnectingServer, setDisconnectingServer] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [spectating, setSpectating] = useState(false);
  const [spectateModal, setSpectateModal] = useState<SpectateModalState>(closedSpectateModal);

  const refreshLobbies = useCallback(async () => {
    setRefreshing(true);
    try {
      const lobbies = await listTournamentLobbies(tournamentId);
      setAvailableLobbies(lobbies.lobbies);
      setServerConnectionStatus(lobbies.status);
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

  useLobbyGateway(tournamentId, {
    onSyncStartConnectionStatus: (data) => {
      if (data.tournamentId !== tournamentId) return;
      setSyncStartConnectionStatus(data);
    },
    onConnectionActive: (data) => {
      if (data.tournamentId !== tournamentId) return;
      setActiveLobbies((prev) => new Map(prev).set(data.lobbyId, data));
      setLobbyCardStates((prev) => {
        if (prev.has(data.lobbyId)) return prev;
        const next = new Map(prev);
        next.set(data.lobbyId, {
          tournamentId: data.tournamentId,
          lobbyId: data.lobbyId,
          lobbyName: data.lobbyName,
          lobbyCode: data.lobbyCode,
          songTitle: "",
          songPath: "",
          players: [],
        });
        return next;
      });
    },
    onConnected: (data) => {
      if (data.tournamentId !== tournamentId) return;
      setActiveLobbies((prev) => new Map(prev).set(data.lobbyId, data));
      setLobbyCardStates((prev) => {
        if (prev.has(data.lobbyId)) return prev;
        const next = new Map(prev);
        next.set(data.lobbyId, {
          tournamentId: data.tournamentId,
          lobbyId: data.lobbyId,
          lobbyName: data.lobbyName,
          lobbyCode: data.lobbyCode,
          songTitle: "",
          songPath: "",
          players: [],
        });
        return next;
      });
    },
    onSongSelected: (data: LobbySongSelectedDto) => {
      if (data.tournamentId !== tournamentId) return;
      setLobbyCardStates((prev) => {
        const next = new Map(prev);
        const existing = next.get(data.lobbyId);
        next.set(data.lobbyId, {
          tournamentId: data.tournamentId,
          lobbyId: data.lobbyId,
          lobbyName: data.lobbyName,
          lobbyCode: data.lobbyCode,
          songTitle: data.songTitle,
          songPath: data.songPath,
          players: existing?.players ?? [],
        });
        return next;
      });
    },
    onPlayerReady: (data: LobbyPlayerReadyDto) => {
      if (data.tournamentId !== tournamentId) return;
      setLobbyCardStates((prev) => {
        const existing = prev.get(data.lobbyId);
        const players = (existing?.players ?? []).filter((player) => player.playerId !== data.playerId);
        players.push({
          playerId: data.playerId,
          playerName: data.playerName,
          ready: data.ready,
        });

        const next = new Map(prev);
        next.set(data.lobbyId, {
          tournamentId: data.tournamentId,
          lobbyId: data.lobbyId,
          lobbyName: data.lobbyName,
          lobbyCode: data.lobbyCode,
          songTitle: existing?.songTitle ?? "",
          songPath: existing?.songPath ?? "",
          players: players.sort((a, b) => a.playerName.localeCompare(b.playerName)),
        });
        return next;
      });
    },
  }, refreshLobbies);

  const lobbies = useMemo(() => {
    const merged = new Map<string, SyncStartLobbyStatusDto>();

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
      const status = await connectLobbyServer(tournamentId);
      setServerConnectionStatus(status);
      toast.success("Connected to SyncStart.");
      if (status.isConnected) {
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
      const status = await disconnectLobbyServer(tournamentId);
      setServerConnectionStatus(status);
      if (!status.isConnected) {
        setAvailableLobbies([]);
      }
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
      await spectateLobby(tournamentId, {
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
      await disconnectLobby(tournamentId, lobbyId);
      setActiveLobbies((prev) => {
        const next = new Map(prev);
        next.delete(lobbyId);
        return next;
      });
      setLobbyCardStates((prev) => {
        const next = new Map(prev);
        next.delete(lobbyId);
        return next;
      });
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
