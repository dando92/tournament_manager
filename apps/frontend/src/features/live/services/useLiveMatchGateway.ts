import { useEffect, useRef } from "react";
import {
  LiveMatchStateDto,
} from "@/features/live/services/syncstartGatewayDtos";
import { realtimeWebSocketUrl, SequencedRealtimeMessage, useRealtimeSocket } from "@/shared/realtime/useRealtimeSocket";

type LiveMatchGatewayMessage =
  | { event: "OnSongSelected"; data: LiveMatchStateDto }
  | { event: "OnMatchUpdate"; data: LiveMatchStateDto }
  | { event: "OnSongCompleted"; data: LiveMatchStateDto };

export type LiveMatchGatewayHandlers = {
  onSongSelected?: (data: LiveMatchStateDto) => void;
  onMatchUpdate?: (data: LiveMatchStateDto) => void;
  onSongCompleted?: (data: LiveMatchStateDto) => void;
  onRecover?: () => void;
};

export function liveMatchGatewayUrl(tournamentId: number): string {
  return realtimeWebSocketUrl("/livematchgateway", tournamentId);
}

export function useLiveMatchGateway(tournamentId: number | null, handlers: LiveMatchGatewayHandlers) {
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useRealtimeSocket("/livematchgateway", tournamentId ?? 0, (message: SequencedRealtimeMessage) => {
        if (!tournamentId) return;
        const msg = message as LiveMatchGatewayMessage & SequencedRealtimeMessage;
        if (msg.event === "OnSongSelected") {
          handlersRef.current.onSongSelected?.(msg.data);
        } else if (msg.event === "OnMatchUpdate") {
          handlersRef.current.onMatchUpdate?.(msg.data);
        } else if (msg.event === "OnSongCompleted") {
          handlersRef.current.onSongCompleted?.(msg.data);
        }
  }, () => handlersRef.current.onRecover?.());
}
