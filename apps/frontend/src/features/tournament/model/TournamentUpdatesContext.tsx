import { ReactNode, useEffect, useRef } from "react";
import { QueryKey, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { SequencedRealtimeMessage, useRealtimeSocket } from "@/shared/realtime/useRealtimeSocket";
import { matchKeys } from "@/features/match/api/match.keys";
import { divisionKeys } from "@/features/division/api/division.keys";
import { tournamentKeys } from "@/features/tournament/api/tournament.keys";

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

const UI_UPDATE_INVALIDATION_DEBOUNCE_MS = 150;

/**
 * What an event makes stale.
 *
 * Every message carries the address of what changed, so the reads it invalidates
 * are the ones scoped to that address and no others. A match event says that one
 * pool's list of matches has moved, and nothing about the tree: the counts the
 * tree draws change under their own event, published by the server only when
 * they actually did. Scoring a round used to re-read the division, the pool and
 * the whole tournament, which is why typing a percentage cost four requests.
 */
function staleAfter(message: TournamentSocketMessage): QueryKey[] {
  switch (message.event) {
    case "TournamentUpdate":
      return [tournamentKeys.overview(message.data.tournamentId)];
    case "DivisionUpdate":
      return [
        tournamentKeys.overview(message.data.tournamentId),
        divisionKeys.summary(message.data.divisionId),
        divisionKeys.entrants(message.data.divisionId),
      ];
    case "PhaseUpdate":
      return [
        tournamentKeys.overview(message.data.tournamentId),
        divisionKeys.summary(message.data.divisionId),
      ];
    case "PhaseGroupUpdate":
      return [
        tournamentKeys.overview(message.data.tournamentId),
        divisionKeys.summary(message.data.divisionId),
        matchKeys.byPhaseGroup(message.data.phaseGroupId),
        matchKeys.byDivision(message.data.divisionId),
      ];
    case "MatchUpdate":
      return [
        matchKeys.byPhaseGroup(message.data.phaseGroupId),
        matchKeys.byDivision(message.data.divisionId),
      ];
    default:
      return [];
  }
}

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
 */
export function TournamentUpdatesProvider({
  tournamentId,
  children,
}: {
  tournamentId: number;
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
      toast.warn(msg.data.message);

      return;
    }

    markStale(staleAfter(msg));
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
