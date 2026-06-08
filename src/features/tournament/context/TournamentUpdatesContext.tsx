import { ReactNode, createContext, useContext, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ActiveLobbyDto,
  LobbyCardStateDto,
  LobbyPlayerReadyDto,
  LobbySongSelectedDto,
  LiveMatchStateDto,
  SyncStartConnectionStatusDto,
  scoreHubUrl,
} from "@/features/live/services/useScoreHub";
import { toast } from "react-toastify";

type TournamentUpdateMessage = {
  tournamentId: number;
};

type DivisionUpdateMessage = {
  tournamentId: number;
  divisionId: number;
};

type PhaseUpdateMessage = {
  tournamentId: number;
  divisionId: number;
  phaseId: number;
};

type PhaseGroupUpdateMessage = {
  tournamentId: number;
  divisionId: number;
  phaseId: number;
  phaseGroupId: number;
};

type MatchUpdateMessage = {
  tournamentId: number;
  divisionId: number;
  phaseId: number;
  phaseGroupId: number;
  matchId: number;
};

type UiWarningMessage = {
  tournamentId: number;
  message: string;
};

type TournamentSocketMessage =
  | { event: "TournamentUpdate"; data: TournamentUpdateMessage }
  | { event: "DivisionUpdate"; data: DivisionUpdateMessage }
  | { event: "PhaseUpdate"; data: PhaseUpdateMessage }
  | { event: "PhaseGroupUpdate"; data: PhaseGroupUpdateMessage }
  | { event: "MatchUpdate"; data: MatchUpdateMessage }
  | { event: "UiWarning"; data: UiWarningMessage };

type LobbySocketMessage =
  | { event: "OnSyncStartConnectionStatus"; data: SyncStartConnectionStatusDto }
  | { event: "OnConnectionActive"; data: ActiveLobbyDto }
  | { event: "OnConnected"; data: ActiveLobbyDto }
  | { event: "OnDisconnection"; data: ActiveLobbyDto }
  | { event: "OnSongSelected"; data: LobbySongSelectedDto }
  | { event: "OnPlayerReady"; data: LobbyPlayerReadyDto }
  | { event: "OnGoingMatchUpdate"; data: LiveMatchStateDto }
  | { event: "OnSongCompleted"; data: LiveMatchStateDto };

type TournamentUpdatesContextValue = {
  tournamentVersion: number;
  divisionDetailVersions: ReadonlyMap<number, number>;
  matchListVersions: ReadonlyMap<number, number>;
  updatedMatchIds: ReadonlySet<number>;
  activeLobbies: ReadonlyMap<string, ActiveLobbyDto>;
  syncStartConnectionStatus: SyncStartConnectionStatusDto;
  lobbyCardStates: ReadonlyMap<string, LobbyCardStateDto>;
  liveMatchStates: ReadonlyMap<string, LiveMatchStateDto>;
};

const defaultValue: TournamentUpdatesContextValue = {
  tournamentVersion: 0,
  divisionDetailVersions: new Map(),
  matchListVersions: new Map(),
  updatedMatchIds: new Set(),
  activeLobbies: new Map(),
  syncStartConnectionStatus: { tournamentId: 0, isActive: false, isConnected: false },
  lobbyCardStates: new Map(),
  liveMatchStates: new Map(),
};

const TournamentUpdatesContext = createContext<TournamentUpdatesContextValue>(defaultValue);

function uiUpdateHubUrl(): string {
  const apiUrl = import.meta.env.VITE_PUBLIC_API_URL ?? "http://localhost:3000/";
  const resolved = new URL("../uiupdatehub", apiUrl);
  return resolved.href.replace(/^http/, "ws");
}

function incrementVersion(map: ReadonlyMap<number, number>, id: number): Map<number, number> {
  const next = new Map(map);
  next.set(id, (next.get(id) ?? 0) + 1);
  return next;
}

const UI_UPDATE_INVALIDATION_DEBOUNCE_MS = 150;

export function TournamentUpdatesProvider({
  tournamentId,
  children,
}: {
  tournamentId: number;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [tournamentVersion, setTournamentVersion] = useState(0);
  const [divisionDetailVersions, setDivisionDetailVersions] = useState<ReadonlyMap<number, number>>(new Map());
  const [matchListVersions, setMatchListVersions] = useState<ReadonlyMap<number, number>>(new Map());
  const [updatedMatchIds, setUpdatedMatchIds] = useState<ReadonlySet<number>>(new Set());
  const [activeLobbies, setActiveLobbies] = useState<ReadonlyMap<string, ActiveLobbyDto>>(new Map());
  const [syncStartConnectionStatus, setSyncStartConnectionStatus] = useState<SyncStartConnectionStatusDto>({
    tournamentId,
    isActive: false,
    isConnected: false,
  });
  const [lobbyCardStates, setLobbyCardStates] = useState<ReadonlyMap<string, LobbyCardStateDto>>(new Map());
  const [liveMatchStates, setLiveMatchStates] = useState<ReadonlyMap<string, LiveMatchStateDto>>(new Map());
  const pendingMatchIds = useRef<Set<number>>(new Set());
  const pendingPhaseGroupIds = useRef<Set<number>>(new Set());
  const pendingDivisionDetailIds = useRef<Set<number>>(new Set());
  const pendingMatchListDivisionIds = useRef<Set<number>>(new Set());
  const pendingDivisionMatchIds = useRef<Set<number>>(new Set());
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const ws = new WebSocket(uiUpdateHubUrl());

    function scheduleInvalidationFlush() {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(flushInvalidations, UI_UPDATE_INVALIDATION_DEBOUNCE_MS);
    }

    function flushInvalidations() {
      const matchIds = new Set(pendingMatchIds.current);
      const phaseGroupIds = new Set(pendingPhaseGroupIds.current);
      const divisionDetailIds = new Set(pendingDivisionDetailIds.current);
      const matchListDivisionIds = new Set(pendingMatchListDivisionIds.current);
      const divisionMatchIds = new Set(pendingDivisionMatchIds.current);

      pendingMatchIds.current = new Set();
      pendingPhaseGroupIds.current = new Set();
      pendingDivisionDetailIds.current = new Set();
      pendingMatchListDivisionIds.current = new Set();
      pendingDivisionMatchIds.current = new Set();
      debounceTimer.current = null;

      if (divisionDetailIds.size > 0) {
        setDivisionDetailVersions((prev) => {
          let next = new Map(prev);
          divisionDetailIds.forEach((divisionId) => {
            next = incrementVersion(next, divisionId);
            queryClient.invalidateQueries({ queryKey: ["division-summary", divisionId] });
          });
          return next;
        });
      }

      if (matchListDivisionIds.size > 0) {
        setMatchListVersions((prev) => {
          let next = new Map(prev);
          matchListDivisionIds.forEach((divisionId) => {
            next = incrementVersion(next, divisionId);
          });
          return next;
        });
      }

      phaseGroupIds.forEach((phaseGroupId) => {
        queryClient.invalidateQueries({
          queryKey: ["matches", "phase-group", phaseGroupId],
          exact: true,
        });
      });

      divisionMatchIds.forEach((divisionId) => {
        queryClient.invalidateQueries({
          queryKey: ["matches", "division", divisionId],
          exact: true,
        });
      });

      if (matchIds.size > 0) {
        setUpdatedMatchIds(matchIds);
      }
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as TournamentSocketMessage;

        if (!msg?.data || msg.data.tournamentId !== tournamentId) {
          return;
        }

        switch (msg.event) {
          case "TournamentUpdate":
            setTournamentVersion((value) => value + 1);
            break;
          case "DivisionUpdate":
            pendingDivisionDetailIds.current.add(msg.data.divisionId);
            scheduleInvalidationFlush();
            break;
          case "PhaseUpdate":
            pendingDivisionDetailIds.current.add(msg.data.divisionId);
            pendingMatchListDivisionIds.current.add(msg.data.divisionId);
            scheduleInvalidationFlush();
            break;
          case "PhaseGroupUpdate":
            pendingPhaseGroupIds.current.add(msg.data.phaseGroupId);
            pendingDivisionMatchIds.current.add(msg.data.divisionId);
            pendingDivisionDetailIds.current.add(msg.data.divisionId);
            pendingMatchListDivisionIds.current.add(msg.data.divisionId);
            scheduleInvalidationFlush();
            break;
          case "MatchUpdate":
            pendingMatchIds.current.add(msg.data.matchId);
            pendingPhaseGroupIds.current.add(msg.data.phaseGroupId);
            pendingDivisionMatchIds.current.add(msg.data.divisionId);
            pendingDivisionDetailIds.current.add(msg.data.divisionId);
            pendingMatchListDivisionIds.current.add(msg.data.divisionId);
            scheduleInvalidationFlush();
            break;
          case "UiWarning":
            toast.warn(msg.data.message);
            break;
        }
      } catch {
        // ignore malformed websocket messages
      }
    };

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      ws.close();
    };
  }, [queryClient, tournamentId]);

  useEffect(() => {
    const ws = new WebSocket(scoreHubUrl());

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as LobbySocketMessage;

        if (!msg?.data || msg.data.tournamentId !== tournamentId) {
          return;
        }

        if (msg.event === "OnSyncStartConnectionStatus") {
          setSyncStartConnectionStatus(msg.data);
          return;
        }

        if (msg.event === "OnConnectionActive" || msg.event === "OnConnected") {
          setActiveLobbies((prev) => new Map(prev).set(msg.data.lobbyId, msg.data));
          setLobbyCardStates((prev) => {
            if (prev.has(msg.data.lobbyId)) return prev;
            const next = new Map(prev);
            next.set(msg.data.lobbyId, {
              tournamentId: msg.data.tournamentId,
              lobbyId: msg.data.lobbyId,
              lobbyName: msg.data.lobbyName,
              lobbyCode: msg.data.lobbyCode,
              songTitle: "",
              songPath: "",
              players: [],
            });
            return next;
          });
          return;
        }

        if (msg.event === "OnDisconnection") {
          if (!msg.data.isActive) {
            setActiveLobbies((prev) => {
              const next = new Map(prev);
              next.delete(msg.data.lobbyId);
              return next;
            });
            setLobbyCardStates((prev) => {
              const next = new Map(prev);
              next.delete(msg.data.lobbyId);
              return next;
            });
            setLiveMatchStates((prev) => {
              const next = new Map(prev);
              next.delete(msg.data.lobbyId);
              return next;
            });
            return;
          }

          setActiveLobbies((prev) => new Map(prev).set(msg.data.lobbyId, msg.data));
          return;
        }

        if (msg.event === "OnSongSelected") {
          setLobbyCardStates((prev) => {
            const next = new Map(prev);
            const existing = next.get(msg.data.lobbyId);
            next.set(msg.data.lobbyId, {
              tournamentId: msg.data.tournamentId,
              lobbyId: msg.data.lobbyId,
              lobbyName: msg.data.lobbyName,
              lobbyCode: msg.data.lobbyCode,
              songTitle: msg.data.songTitle,
              songPath: msg.data.songPath,
              players: existing?.players ?? [],
            });
            return next;
          });
          setLiveMatchStates((prev) => {
            const existing = prev.get(msg.data.lobbyId);
            if (!existing) return prev;

            const next = new Map(prev);
            next.set(msg.data.lobbyId, {
              ...existing,
              tournamentId: msg.data.tournamentId,
              lobbyId: msg.data.lobbyId,
              lobbyName: msg.data.lobbyName,
              lobbyCode: msg.data.lobbyCode,
              songTitle: msg.data.songTitle,
              songPath: msg.data.songPath,
            });
            return next;
          });
          return;
        }

        if (msg.event === "OnPlayerReady") {
          setLobbyCardStates((prev) => {
            const existing = prev.get(msg.data.lobbyId);
            const players = (existing?.players ?? []).filter(
              (player) => player.playerId !== msg.data.playerId,
            );
            players.push({
              playerId: msg.data.playerId,
              playerName: msg.data.playerName,
              ready: msg.data.ready,
            });

            const next = new Map(prev);
            next.set(msg.data.lobbyId, {
              tournamentId: msg.data.tournamentId,
              lobbyId: msg.data.lobbyId,
              lobbyName: msg.data.lobbyName,
              lobbyCode: msg.data.lobbyCode,
              songTitle: existing?.songTitle ?? "",
              songPath: existing?.songPath ?? "",
              players: players.sort((a, b) => a.playerName.localeCompare(b.playerName)),
            });
            return next;
          });
          return;
        }

        if (msg.event === "OnGoingMatchUpdate" || msg.event === "OnSongCompleted") {
          setLiveMatchStates((prev) => new Map(prev).set(msg.data.lobbyId, msg.data));
        }
      } catch {
        // ignore malformed websocket messages
      }
    };

    return () => {
      ws.close();
    };
  }, [tournamentId]);

  return (
    <TournamentUpdatesContext.Provider
      value={{
        tournamentVersion,
        divisionDetailVersions,
        matchListVersions,
        updatedMatchIds,
        activeLobbies,
        syncStartConnectionStatus,
        lobbyCardStates,
        liveMatchStates,
      }}
    >
      {children}
    </TournamentUpdatesContext.Provider>
  );
}

export function useTournamentUpdates() {
  return useContext(TournamentUpdatesContext);
}
