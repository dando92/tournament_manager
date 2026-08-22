import { useEffect, useRef } from "react";
import {
  ActiveLobbyDto,
  LobbyPlayerReadyDto,
  LobbySongSelectedDto,
  SyncStartConnectionStatusDto,
} from "@/features/live/model/types";
import { realtimeWebSocketUrl, SequencedRealtimeMessage, useRealtimeSocket } from "@/shared/realtime/useRealtimeSocket";

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
  return realtimeWebSocketUrl("/lobbygateway", tournamentId);
}

export function useLobbyGateway(tournamentId: number, handlers: LobbyGatewayHandlers, onRecover?: () => void | Promise<void>) {
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useRealtimeSocket("/lobbygateway", tournamentId, (message: SequencedRealtimeMessage) => {
      const msg = message as LobbyGatewayMessage & SequencedRealtimeMessage;
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
  }, onRecover);
}
