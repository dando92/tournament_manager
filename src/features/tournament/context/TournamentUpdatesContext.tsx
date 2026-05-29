import { ReactNode, createContext, useContext, useEffect, useRef, useState } from "react";
import {
  ActiveLobbyDto,
  LobbyStateDto,
  LiveMatchStateDto,
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

type MatchUpdateMessage = {
  tournamentId: number;
  divisionId: number;
  phaseId: number;
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
  | { event: "MatchUpdate"; data: MatchUpdateMessage }
  | { event: "UiWarning"; data: UiWarningMessage };

type LobbySocketMessage =
  | { event: "OnLobbyActive"; data: ActiveLobbyDto }
  | { event: "OnLobbyDisconnected"; data: { tournamentId: number; lobbyId: string } }
  | { event: "OnLobbyState"; data: LobbyStateDto }
  | { event: "OnLiveMatchState"; data: LiveMatchStateDto };

type TournamentUpdatesContextValue = {
  tournamentVersion: number;
  divisionDetailVersions: ReadonlyMap<number, number>;
  matchListVersions: ReadonlyMap<number, number>;
  updatedMatchIds: ReadonlySet<number>;
  activeLobbies: ReadonlyMap<string, ActiveLobbyDto>;
  lobbyStates: ReadonlyMap<string, LobbyStateDto>;
  liveLobbyDisplayStates: ReadonlyMap<string, LobbyStateDto>;
  liveMatchStates: ReadonlyMap<string, LiveMatchStateDto>;
};

const defaultValue: TournamentUpdatesContextValue = {
  tournamentVersion: 0,
  divisionDetailVersions: new Map(),
  matchListVersions: new Map(),
  updatedMatchIds: new Set(),
  activeLobbies: new Map(),
  lobbyStates: new Map(),
  liveLobbyDisplayStates: new Map(),
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

export function TournamentUpdatesProvider({
  tournamentId,
  children,
}: {
  tournamentId: number;
  children: ReactNode;
}) {
  const [tournamentVersion, setTournamentVersion] = useState(0);
  const [divisionDetailVersions, setDivisionDetailVersions] = useState<ReadonlyMap<number, number>>(new Map());
  const [matchListVersions, setMatchListVersions] = useState<ReadonlyMap<number, number>>(new Map());
  const [updatedMatchIds, setUpdatedMatchIds] = useState<ReadonlySet<number>>(new Set());
  const [activeLobbies, setActiveLobbies] = useState<ReadonlyMap<string, ActiveLobbyDto>>(new Map());
  const [lobbyStates, setLobbyStates] = useState<ReadonlyMap<string, LobbyStateDto>>(new Map());
  const [liveLobbyDisplayStates, setLiveLobbyDisplayStates] = useState<ReadonlyMap<string, LobbyStateDto>>(new Map());
  const [liveMatchStates, setLiveMatchStates] = useState<ReadonlyMap<string, LiveMatchStateDto>>(new Map());
  const pendingMatchIds = useRef<Set<number>>(new Set());
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const ws = new WebSocket(uiUpdateHubUrl());

    function flushMatchUpdates() {
      const flush = new Set(pendingMatchIds.current);
      pendingMatchIds.current = new Set();
      setUpdatedMatchIds(flush);
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
            setDivisionDetailVersions((prev) => incrementVersion(prev, msg.data.divisionId));
            break;
          case "PhaseUpdate":
            setDivisionDetailVersions((prev) => incrementVersion(prev, msg.data.divisionId));
            setMatchListVersions((prev) => incrementVersion(prev, msg.data.divisionId));
            break;
          case "MatchUpdate":
            pendingMatchIds.current.add(msg.data.matchId);
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
            debounceTimer.current = setTimeout(flushMatchUpdates, 50);
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
  }, [tournamentId]);

  useEffect(() => {
    const ws = new WebSocket(scoreHubUrl());

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as LobbySocketMessage;

        if (!msg?.data || msg.data.tournamentId !== tournamentId) {
          return;
        }

        if (msg.event === "OnLobbyActive") {
          setActiveLobbies((prev) => new Map(prev).set(msg.data.lobbyId, msg.data));
          return;
        }

        if (msg.event === "OnLobbyDisconnected") {
          setActiveLobbies((prev) => {
            const next = new Map(prev);
            next.delete(msg.data.lobbyId);
            return next;
          });
          setLobbyStates((prev) => {
            const next = new Map(prev);
            next.delete(msg.data.lobbyId);
            return next;
          });
          setLiveLobbyDisplayStates((prev) => {
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

        if (msg.event === "OnLobbyState") {
          setLobbyStates((prev) => new Map(prev).set(msg.data.lobbyId, msg.data));
          setLiveLobbyDisplayStates((prev) => {
            const next = new Map(prev);
            const hasGameplay = msg.data.players.some((player) => player.screenName === "ScreenGameplay");
            const hasEvaluation = msg.data.players.some(
              (player) => player.screenName === "ScreenEvaluationStage",
            );

            if (hasGameplay) {
              next.delete(msg.data.lobbyId);
              return next;
            }

            if (hasEvaluation) {
              next.set(msg.data.lobbyId, msg.data);
            }

            return next;
          });
          if (msg.data.players.some((player) => player.screenName === "ScreenGameplay")) {
            setLiveMatchStates((prev) => {
              if (!prev.has(msg.data.lobbyId)) return prev;
              const next = new Map(prev);
              next.delete(msg.data.lobbyId);
              return next;
            });
          }
          return;
        }

        if (msg.event === "OnLiveMatchState") {
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
        lobbyStates,
        liveLobbyDisplayStates,
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
