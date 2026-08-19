import { useEffect, useRef } from "react";
import { realtimeUrl } from "../runtime-config";

export type SequencedRealtimeMessage = {
  event: string;
  data: unknown;
  sequence: number;
};

type RealtimePath = "/uiupdatehub" | "/lobbygateway" | "/livematchgateway";

export function realtimeHttpUrl(): string {
  return realtimeUrl();
}

export function realtimeWebSocketUrl(path: RealtimePath, tournamentId: number): string {
  const resolved = new URL(path.slice(1), realtimeHttpUrl());
  resolved.searchParams.set("tournamentId", String(tournamentId));
  return resolved.href.replace(/^http/, "ws");
}

export function useRealtimeSocket(
  path: RealtimePath,
  tournamentId: number,
  onMessage: (message: SequencedRealtimeMessage) => void,
  onAuthoritativeRecovery?: () => void | Promise<void>,
) {
  const messageHandler = useRef(onMessage);
  const recoveryHandler = useRef(onAuthoritativeRecovery);

  useEffect(() => { messageHandler.current = onMessage; }, [onMessage]);
  useEffect(() => { recoveryHandler.current = onAuthoritativeRecovery; }, [onAuthoritativeRecovery]);

  useEffect(() => {
    if (!Number.isSafeInteger(tournamentId) || tournamentId <= 0) return;
    let socket: WebSocket | undefined;
    let stopped = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let reconnectAttempt = 0;
    let lastSequence: number | undefined;
    let needsRecovery = false;

    async function recoverSnapshot() {
      await recoveryHandler.current?.();
      const url = new URL("realtime/snapshot", realtimeHttpUrl());
      url.searchParams.set("tournamentId", String(tournamentId));
      url.searchParams.set("path", path);
      try {
        const response = await fetch(url);
        if (!response.ok) return;
        const snapshot = await response.json() as { sequence: number; messages: SequencedRealtimeMessage[] };
        for (const message of snapshot.messages) messageHandler.current(message);
        lastSequence = snapshot.sequence;
      } catch {
        // HTTP application state remains usable while realtime is unavailable.
      }
    }

    function connect() {
      if (stopped) return;
      socket = new WebSocket(realtimeWebSocketUrl(path, tournamentId));
      socket.onopen = () => {
        reconnectAttempt = 0;
        if (needsRecovery) {
          needsRecovery = false;
          void recoverSnapshot();
        }
      };
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as SequencedRealtimeMessage;
          if (!Number.isSafeInteger(message.sequence)) return;
          if (message.event === "RealtimeReady") {
            if ((lastSequence === undefined && message.sequence > 0) ||
                (lastSequence !== undefined && message.sequence > lastSequence)) void recoverSnapshot();
            lastSequence = message.sequence;
            return;
          }
          if (lastSequence !== undefined && message.sequence > lastSequence + 1) {
            void recoverSnapshot();
            return;
          }
          if (lastSequence !== undefined && message.sequence <= lastSequence) return;
          lastSequence = message.sequence;
          if (message.event !== "RealtimeSequence") messageHandler.current(message);
        } catch {
          // Ignore malformed WebSocket messages and retain the last HTTP snapshot.
        }
      };
      socket.onclose = () => {
        if (stopped) return;
        needsRecovery = true;
        const delay = Math.min(5000, 250 * 2 ** reconnectAttempt++);
        reconnectTimer = setTimeout(connect, delay);
      };
    }

    connect();
    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [path, tournamentId]);
}
