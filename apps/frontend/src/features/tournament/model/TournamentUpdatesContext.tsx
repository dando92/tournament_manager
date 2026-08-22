import { ReactNode, createContext, useContext, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { SequencedRealtimeMessage, useRealtimeSocket } from "@/shared/realtime/useRealtimeSocket";
import { matchKeys } from "@/features/match/api/match.keys";
import { divisionKeys } from "@/features/division/services/divisions.keys";

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

type TournamentUpdatesContextValue = {
  tournamentVersion: number;
  divisionDetailVersions: ReadonlyMap<number, number>;
  matchListVersions: ReadonlyMap<number, number>;
  updatedMatchIds: ReadonlySet<number>;
};

const defaultValue: TournamentUpdatesContextValue = {
  tournamentVersion: 0,
  divisionDetailVersions: new Map(),
  matchListVersions: new Map(),
  updatedMatchIds: new Set(),
};

const TournamentUpdatesContext = createContext<TournamentUpdatesContextValue>(defaultValue);

function incrementVersion(map: ReadonlyMap<number, number>, id: number): Map<number, number> {
  const next = new Map(map);
  next.set(id, (next.get(id) ?? 0) + 1);
  return next;
}

const UI_UPDATE_INVALIDATION_DEBOUNCE_MS = 150;

export function TournamentUpdatesProvider({
  tournamentId,
  children,
}: {
  tournamentId: number;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [tournamentVersion, setTournamentVersion] = useState(0);
  const [divisionDetailVersions, setDivisionDetailVersions] = useState<ReadonlyMap<number, number>>(new Map());
  const [matchListVersions, setMatchListVersions] = useState<ReadonlyMap<number, number>>(new Map());
  const [updatedMatchIds, setUpdatedMatchIds] = useState<ReadonlySet<number>>(new Set());
  const pendingMatchIds = useRef<Set<number>>(new Set());
  const pendingPhaseGroupIds = useRef<Set<number>>(new Set());
  const pendingDivisionDetailIds = useRef<Set<number>>(new Set());
  const pendingMatchListDivisionIds = useRef<Set<number>>(new Set());
  const pendingDivisionMatchIds = useRef<Set<number>>(new Set());
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    function scheduleInvalidationFlush() {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(flushInvalidations, UI_UPDATE_INVALIDATION_DEBOUNCE_MS);
    }

    function flushInvalidations() {
      const matchIds = new Set(pendingMatchIds.current);
      const phaseGroupIds = new Set(pendingPhaseGroupIds.current);
      const divisionDetailIds = new Set(pendingDivisionDetailIds.current);
      const matchListDivisionIds = new Set(pendingMatchListDivisionIds.current);
      const divisionMatchIds = new Set(pendingDivisionMatchIds.current);

      pendingMatchIds.current = new Set();
      pendingPhaseGroupIds.current = new Set();
      pendingDivisionDetailIds.current = new Set();
      pendingMatchListDivisionIds.current = new Set();
      pendingDivisionMatchIds.current = new Set();
      debounceTimer.current = null;

      if (divisionDetailIds.size > 0) {
        setDivisionDetailVersions((prev) => {
          let next = new Map(prev);
          divisionDetailIds.forEach((divisionId) => {
            next = incrementVersion(next, divisionId);
            queryClient.invalidateQueries({ queryKey: divisionKeys.summary(divisionId) });
          });
          return next;
        });
      }

      if (matchListDivisionIds.size > 0) {
        setMatchListVersions((prev) => {
          let next = new Map(prev);
          matchListDivisionIds.forEach((divisionId) => {
            next = incrementVersion(next, divisionId);
          });
          return next;
        });
      }

      phaseGroupIds.forEach((phaseGroupId) => {
        queryClient.invalidateQueries({
          queryKey: matchKeys.byPhaseGroup(phaseGroupId),
          exact: true,
        });
      });

      divisionMatchIds.forEach((divisionId) => {
        queryClient.invalidateQueries({
          queryKey: matchKeys.byDivision(divisionId),
          exact: true,
        });
      });

      if (matchIds.size > 0) {
        setUpdatedMatchIds(matchIds);
      }
    }

  useRealtimeSocket("/uiupdatehub", tournamentId, (message: SequencedRealtimeMessage, replayed: boolean) => {
        const msg = message as TournamentSocketMessage & SequencedRealtimeMessage;

        /* Replayed messages are history, and nothing here keeps state of its
           own: every case below only says which query went stale, which the
           pages have just fetched anyway. Acting on them would refetch the
           whole tournament on load and toast warnings that are already old.
           What a client that was away actually needs is the recovery below. */
        if (replayed) return;

        if (!msg?.data || msg.data.tournamentId !== tournamentId) {
          return;
        }

        switch (msg.event) {
          case "TournamentUpdate":
            setTournamentVersion((value) => value + 1);
            break;
          case "DivisionUpdate":
            pendingDivisionDetailIds.current.add(msg.data.divisionId);
            scheduleInvalidationFlush();
            break;
          case "PhaseUpdate":
            pendingDivisionDetailIds.current.add(msg.data.divisionId);
            pendingMatchListDivisionIds.current.add(msg.data.divisionId);
            scheduleInvalidationFlush();
            break;
          case "PhaseGroupUpdate":
            pendingPhaseGroupIds.current.add(msg.data.phaseGroupId);
            pendingDivisionMatchIds.current.add(msg.data.divisionId);
            pendingDivisionDetailIds.current.add(msg.data.divisionId);
            pendingMatchListDivisionIds.current.add(msg.data.divisionId);
            scheduleInvalidationFlush();
            break;
          case "MatchUpdate":
            pendingMatchIds.current.add(msg.data.matchId);
            pendingPhaseGroupIds.current.add(msg.data.phaseGroupId);
            pendingDivisionMatchIds.current.add(msg.data.divisionId);
            pendingDivisionDetailIds.current.add(msg.data.divisionId);
            pendingMatchListDivisionIds.current.add(msg.data.divisionId);
            scheduleInvalidationFlush();
            break;
          case "UiWarning":
            toast.warn(msg.data.message);
            break;
        }
  }, async () => {
    /* Reached only after events were missed. Which ones is unknowable by
       then, and the query keys are scoped to divisions and pools rather than
       to a tournament, so there is no narrower filter to pass: everything on
       screen has to be re-read. */
    await queryClient.invalidateQueries();
    setTournamentVersion((value) => value + 1);
  });

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  return (
    <TournamentUpdatesContext.Provider
      value={{
        tournamentVersion,
        divisionDetailVersions,
        matchListVersions,
        updatedMatchIds,
      }}
    >
      {children}
    </TournamentUpdatesContext.Provider>
  );
}

export function useTournamentUpdates() {
  return useContext(TournamentUpdatesContext);
}
