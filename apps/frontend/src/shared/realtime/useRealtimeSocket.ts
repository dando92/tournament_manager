import { useEffect, useRef } from "react";
import { realtimeUrl } from "../runtime-config";

export type SequencedRealtimeMessage = {
  event: string;
  data: unknown;
  sequence: number;
};

/** The payload of the frame the server opens every connection with. */
type RealtimeReadyData = {
  tournamentId: number;
  messages: SequencedRealtimeMessage[];
};

type RealtimePath = "/uiupdatehub" | "/lobbygateway" | "/livematchgateway";

export function realtimeWebSocketUrl(path: RealtimePath, tournamentId: number): string {
  const resolved = new URL(path.slice(1), realtimeUrl());
  resolved.searchParams.set("tournamentId", String(tournamentId));
  return resolved.href.replace(/^http/, "ws");
}

/**
 * One tournament-scoped realtime socket.
 *
 * Connecting is itself the snapshot: the `RealtimeReady` frame carries the
 * cached state together with the sequence it belongs to, so there is nothing
 * left to reconcile afterwards. Those cached messages arrive with `replayed`
 * set, which lets a consumer whose data comes from HTTP skip history it has
 * already loaded — a signal saying "a match changed" is worth nothing to a
 * page that fetched that match a moment ago.
 *
 * `onAuthoritativeRecovery` is for the one case the stream cannot repair on
 * its own: events that happened while nobody was listening. It runs when a
 * reconnection resumes at a later sequence, or when the live stream skips one.
 * A first connection recovers nothing, because the page has just loaded the
 * state it would be recovering.
 */
export function useRealtimeSocket(
  path: RealtimePath,
  tournamentId: number,
  onMessage: (message: SequencedRealtimeMessage, replayed: boolean) => void,
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
    let resumed = false;

    function connect() {
      if (stopped) return;
      socket = new WebSocket(realtimeWebSocketUrl(path, tournamentId));
      socket.onopen = () => {
        reconnectAttempt = 0;
      };
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as SequencedRealtimeMessage;
          if (!Number.isSafeInteger(message.sequence)) return;
          if (message.event === "RealtimeReady") {
            /* Only a socket that comes back to a sequence it has not seen was
               away while something happened. */
            if (resumed && (lastSequence === undefined || message.sequence > lastSequence)) {
              void recoveryHandler.current?.();
            }
            resumed = false;
            const ready = message.data as RealtimeReadyData | undefined;
            for (const cached of ready?.messages ?? []) messageHandler.current(cached, true);
            lastSequence = message.sequence;
            return;
          }
          if (lastSequence !== undefined && message.sequence > lastSequence + 1) {
            void recoveryHandler.current?.();
          }
          if (lastSequence !== undefined && message.sequence <= lastSequence) return;
          lastSequence = message.sequence;
          if (message.event !== "RealtimeSequence") messageHandler.current(message, false);
        } catch {
          // Ignore malformed WebSocket messages and retain the state already loaded.
        }
      };
      socket.onclose = () => {
        if (stopped) return;
        resumed = true;
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
