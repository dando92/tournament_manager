import { useEffect, useRef } from "react";
import {
  LiveMatchStateDto,
} from "@/features/live/services/syncstartGatewayDtos";

type LiveMatchGatewayMessage =
  | { event: "OnSongSelected"; data: LiveMatchStateDto }
  | { event: "OnMatchUpdate"; data: LiveMatchStateDto }
  | { event: "OnSongCompleted"; data: LiveMatchStateDto };

export type LiveMatchGatewayHandlers = {
  onSongSelected?: (data: LiveMatchStateDto) => void;
  onMatchUpdate?: (data: LiveMatchStateDto) => void;
  onSongCompleted?: (data: LiveMatchStateDto) => void;
};

export function liveMatchGatewayUrl(tournamentId: number): string {
  const apiUrl = import.meta.env.VITE_PUBLIC_API_URL ?? "http://localhost:3000/";
  const resolved = new URL("../livematchgateway", apiUrl);
  resolved.searchParams.set("tournamentId", String(tournamentId));
  return resolved.href.replace(/^http/, "ws");
}

export function useLiveMatchGateway(tournamentId: number | null, handlers: LiveMatchGatewayHandlers) {
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!tournamentId || !Number.isFinite(tournamentId)) {
      return;
    }

    const ws = new WebSocket(liveMatchGatewayUrl(tournamentId));

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as LiveMatchGatewayMessage;
        if (msg.event === "OnSongSelected") {
          handlersRef.current.onSongSelected?.(msg.data);
        } else if (msg.event === "OnMatchUpdate") {
          handlersRef.current.onMatchUpdate?.(msg.data);
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
  }, [tournamentId]);
}
