import { ReactNode, useEffect, useRef } from "react";
import { QueryKey, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { SequencedRealtimeMessage, useRealtimeSocket } from "@/shared/realtime/useRealtimeSocket";
import { TournamentSocketMessage, staleAfterUpdate } from "@/features/tournament/model/staleAfterUpdate";

const UI_UPDATE_INVALIDATION_DEBOUNCE_MS = 150;

/**
 * The one path from a write to the interface.
 *
 * A mutation answers `204` and applies nothing locally. The server publishes
 * what it changed, this listener marks those reads stale, and React Query
 * refetches the ones on screen. Somebody else's change and your own therefore
 * arrive the same way, which is what stops the two from disagreeing.
 *
 * It provides no context. What it produces is invalidation, and the query cache
 * already carries that to every reader.
 *
 * Invalidation reaches everyone watching; the warning toast does not. A warning
 * says a run arrived from a cabinet and was not saved, which is addressed to
 * whoever can go and fix it. `canEdit` is the same value the tree is given, so
 * the two agree on who is operating the tournament.
 */
export function TournamentUpdatesProvider({
  tournamentId,
  canEdit,
  children,
}: {
  tournamentId: number;
  canEdit: boolean;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const pendingKeys = useRef<Map<string, QueryKey>>(new Map());
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* A commit publishes several events at once, and a bracket generation
     publishes one per pool it built. Collecting them for a moment turns a burst
     into one refetch per read rather than one per message. */
  function markStale(keys: QueryKey[]) {
    keys.forEach((key) => pendingKeys.current.set(JSON.stringify(key), key));
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(flushInvalidations, UI_UPDATE_INVALIDATION_DEBOUNCE_MS);
  }

  function flushInvalidations() {
    const keys = [...pendingKeys.current.values()];
    pendingKeys.current = new Map();
    debounceTimer.current = null;

    keys.forEach((queryKey) => queryClient.invalidateQueries({ queryKey, exact: true }));
  }

  useRealtimeSocket("/uiupdatehub", tournamentId, (message: SequencedRealtimeMessage, replayed: boolean) => {
    const msg = message as TournamentSocketMessage & SequencedRealtimeMessage;

    /* Replayed messages are history, and nothing here keeps state of its own:
       every case below only says which query went stale, which the pages have
       just fetched anyway. Acting on them would refetch the whole tournament on
       load and toast warnings that are already old. What a client that was away
       actually needs is the recovery below. */
    if (replayed) return;

    if (!msg?.data || msg.data.tournamentId !== tournamentId) return;

    if (msg.event === "UiWarning") {
      if (canEdit) toast.warn(msg.data.message);

      return;
    }

    markStale(staleAfterUpdate(msg));
  }, async () => {
    /* Reached only after events were missed. Which ones is unknowable by then,
       and the query keys are scoped to divisions and pools rather than to a
       tournament, so there is no narrower filter to pass: everything on screen
       has to be re-read. */
    await queryClient.invalidateQueries();
  });

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  return <>{children}</>;
}
