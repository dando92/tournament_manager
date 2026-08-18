import { ReactNode, createContext, useContext, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";

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

function uiUpdateHubUrl(): string {
  const apiUrl = import.meta.env.VITE_PUBLIC_API_URL ?? "http://localhost:3000/";
  const resolved = new URL("../uiupdatehub", apiUrl);
  return resolved.href.replace(/^http/, "ws");
}

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

  useEffect(() => {
    const ws = new WebSocket(uiUpdateHubUrl());

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
            queryClient.invalidateQueries({ queryKey: ["division-summary", divisionId] });
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
          queryKey: ["matches", "phase-group", phaseGroupId],
          exact: true,
        });
      });

      divisionMatchIds.forEach((divisionId) => {
        queryClient.invalidateQueries({
          queryKey: ["matches", "division", divisionId],
          exact: true,
        });
      });

      if (matchIds.size > 0) {
        setUpdatedMatchIds(matchIds);
      }
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as TournamentSocketMessage;

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
      } catch {
        // ignore malformed websocket messages
      }
    };

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      ws.close();
    };
  }, [queryClient, tournamentId]);

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
