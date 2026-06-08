import { useEffect, useRef } from "react";

export type ActiveLobbyDto = {
  tournamentId: number;
  lobbyId: string;
  lobbyName: string;
  lobbyCode: string;
  isActive: boolean;
  isConnected: boolean;
};

export type SyncStartConnectionStatusDto = {
  tournamentId: number;
  isActive: boolean;
  isConnected: boolean;
};

export type LobbySongSelectedDto = {
  tournamentId: number;
  lobbyId: string;
  lobbyName: string;
  lobbyCode: string;
  songTitle: string;
  songPath: string;
};

export type LobbyPlayerReadyDto = {
  tournamentId: number;
  lobbyId: string;
  lobbyName: string;
  lobbyCode: string;
  playerId: string;
  playerName: string;
  ready: boolean;
};

export type LobbyCardPlayerDto = {
  playerId: string;
  playerName: string;
  ready: boolean;
};

export type LobbyCardStateDto = {
  tournamentId: number;
  lobbyId: string;
  lobbyName: string;
  lobbyCode: string;
  songTitle: string;
  songPath: string;
  players: LobbyCardPlayerDto[];
};

export type LiveMatchPlayerDto = {
  playerId: string;
  playerName: string;
  score: number;
  exScore?: number;
  isFailed: boolean;
  isCompleted?: boolean;
  songProgression?: {
    currentTime: number;
    totalTime: number;
  };
  judgments?: {
    fantasticPlus: number;
    fantastics: number;
    excellents: number;
    greats: number;
    decents: number;
    wayOffs: number;
    misses: number;
    minesHit: number;
    holdsHeld: number;
    totalHolds: number;
  };
};

export type LiveMatchStateDto = {
  tournamentId: number;
  lobbyId: string;
  lobbyName: string;
  lobbyCode: string;
  songTitle: string;
  songPath: string;
  players: LiveMatchPlayerDto[];
};

type ScoreHubMessage =
  | { event: "OnSyncStartConnectionStatus"; data: SyncStartConnectionStatusDto }
  | { event: "OnConnectionActive"; data: ActiveLobbyDto }
  | { event: "OnConnected"; data: ActiveLobbyDto }
  | { event: "OnDisconnection"; data: ActiveLobbyDto }
  | { event: "OnSongSelected"; data: LobbySongSelectedDto }
  | { event: "OnPlayerReady"; data: LobbyPlayerReadyDto }
  | { event: "OnGoingMatchUpdate"; data: LiveMatchStateDto }
  | { event: "OnSongCompleted"; data: LiveMatchStateDto };

export type ScoreHubHandlers = {
  onSyncStartConnectionStatus?: (data: SyncStartConnectionStatusDto) => void;
  onConnectionActive?: (data: ActiveLobbyDto) => void;
  onConnected?: (data: ActiveLobbyDto) => void;
  onDisconnection?: (data: ActiveLobbyDto) => void;
  onSongSelected?: (data: LobbySongSelectedDto) => void;
  onPlayerReady?: (data: LobbyPlayerReadyDto) => void;
  onGoingMatchUpdate?: (data: LiveMatchStateDto) => void;
  onSongCompleted?: (data: LiveMatchStateDto) => void;
};

export function scoreHubUrl(): string {
  const apiUrl = import.meta.env.VITE_PUBLIC_API_URL ?? "http://localhost:3000/";
  const resolved = new URL("../scoreupdatehub", apiUrl);
  return resolved.href.replace(/^http/, "ws");
}

export function useScoreHub(handlers: ScoreHubHandlers) {
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    const ws = new WebSocket(scoreHubUrl());

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ScoreHubMessage;
        if (msg.event === "OnSyncStartConnectionStatus") {
          handlersRef.current.onSyncStartConnectionStatus?.(msg.data);
        } else if (msg.event === "OnConnectionActive") {
          handlersRef.current.onConnectionActive?.(msg.data);
        } else if (msg.event === "OnConnected") {
          handlersRef.current.onConnected?.(msg.data);
        } else if (msg.event === "OnDisconnection") {
          handlersRef.current.onDisconnection?.(msg.data);
        } else if (msg.event === "OnSongSelected") {
          handlersRef.current.onSongSelected?.(msg.data);
        } else if (msg.event === "OnPlayerReady") {
          handlersRef.current.onPlayerReady?.(msg.data);
        } else if (msg.event === "OnGoingMatchUpdate") {
          handlersRef.current.onGoingMatchUpdate?.(msg.data);
        } else if (msg.event === "OnSongCompleted") {
          handlersRef.current.onSongCompleted?.(msg.data);
        }
      } catch {
        // ignore malformed websocket messages
      }
    };

    return () => {
      ws.close();
    };
  }, []);
}
