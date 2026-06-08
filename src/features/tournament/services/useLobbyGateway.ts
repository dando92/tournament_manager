import { useEffect, useRef } from "react";
import {
  ActiveLobbyDto,
  LobbyPlayerReadyDto,
  LobbySongSelectedDto,
  SyncStartConnectionStatusDto,
} from "@/features/live/services/syncstartGatewayDtos";

type LobbyGatewayMessage =
  | { event: "OnSyncStartConnectionStatus"; data: SyncStartConnectionStatusDto }
  | { event: "OnConnectionActive"; data: ActiveLobbyDto }
  | { event: "OnConnected"; data: ActiveLobbyDto }
  | { event: "OnSongSelected"; data: LobbySongSelectedDto }
  | { event: "OnPlayerReady"; data: LobbyPlayerReadyDto };

export type LobbyGatewayHandlers = {
  onSyncStartConnectionStatus?: (data: SyncStartConnectionStatusDto) => void;
  onConnectionActive?: (data: ActiveLobbyDto) => void;
  onConnected?: (data: ActiveLobbyDto) => void;
  onSongSelected?: (data: LobbySongSelectedDto) => void;
  onPlayerReady?: (data: LobbyPlayerReadyDto) => void;
};

export function lobbyGatewayUrl(tournamentId: number): string {
  const apiUrl = import.meta.env.VITE_PUBLIC_API_URL ?? "http://localhost:3000/";
  const resolved = new URL("../lobbygateway", apiUrl);
  resolved.searchParams.set("tournamentId", String(tournamentId));
  return resolved.href.replace(/^http/, "ws");
}

export function useLobbyGateway(tournamentId: number, handlers: LobbyGatewayHandlers) {
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    const ws = new WebSocket(lobbyGatewayUrl(tournamentId));

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as LobbyGatewayMessage;
        if (msg.event === "OnSyncStartConnectionStatus") {
          handlersRef.current.onSyncStartConnectionStatus?.(msg.data);
        } else if (msg.event === "OnConnectionActive") {
          handlersRef.current.onConnectionActive?.(msg.data);
        } else if (msg.event === "OnConnected") {
          handlersRef.current.onConnected?.(msg.data);
        } else if (msg.event === "OnSongSelected") {
          handlersRef.current.onSongSelected?.(msg.data);
        } else if (msg.event === "OnPlayerReady") {
          handlersRef.current.onPlayerReady?.(msg.data);
        }
      } catch {
        // ignore malformed websocket messages
      }
    };

    return () => {
      ws.close();
    };
  }, [tournamentId]);
}
