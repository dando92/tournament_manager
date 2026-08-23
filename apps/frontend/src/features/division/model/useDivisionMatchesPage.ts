import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useDivisionPageContext } from "@/features/division/model/DivisionPageContext";
import { PhaseGroup } from "@/features/division/model/types";
import { phaseGroupLabel } from "@/features/division/model/phaseGroupLabel";
import { useCreateMatchAction } from "@/features/match/model/useCreateMatchAction";
import { useMatches } from "@/features/match/model/useMatches";
import { Match, MatchHighlight } from "@/features/match/model/types";
import { matchMatchesQuery } from "@/features/match/model/matchSearch";

/** A pool in scope, carrying the matches the division-wide list holds for it. */
export type PoolGroup = {
  pool: PhaseGroup;
  phaseId: number;
  phaseName: string;
  matches: Match[];
};

/**
 * What the flat match list is showing, and what the address says about it.
 *
 * The branch decides the scope — a pool, a phase, or a whole division — and the
 * open match and the pool advancement editor are search parameters, so both
 * survive a refresh and can be handed to someone else. All of that is state
 * about the page rather than about a match, which is why it is here and not in
 * the card.
 */
export function useDivisionMatchesPage() {
  const { division, entrants, tournamentId, controls } = useDivisionPageContext();
  const { phaseId: phaseIdParam, poolId: poolIdParam } = useParams<{ phaseId?: string; poolId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState<MatchHighlight>({ matchId: null, phaseGroupId: null });
  const { matches, actions } = useMatches(division.id);
  const matchCreation = useCreateMatchAction();

  const scopePhaseId = phaseIdParam ? Number(phaseIdParam) : null;
  const scopePoolId = poolIdParam ? Number(poolIdParam) : null;
  const searching = query.trim().length > 0;

  /* One request covers every scope, so widening or narrowing the branch never
     costs a round trip. Search deliberately ignores the scope: the question
     people ask mid-tournament is where a player or a song ended up, and an
     answer that stops at the open pool does not answer it. */
  const groups = useMemo<PoolGroup[]>(() => {
    const byPool = new Map<number, Match[]>();
    matches.forEach((match) => {
      const bucket = byPool.get(match.phaseGroupId);
      if (bucket) bucket.push(match);
      else byPool.set(match.phaseGroupId, [match]);
    });

    return (division.phases ?? [])
      .filter((phase) => searching || scopePhaseId === null || phase.id === scopePhaseId)
      .flatMap((phase) =>
        (phase.phaseGroups ?? [])
          .filter((pool) => searching || scopePoolId === null || pool.id === scopePoolId)
          .map((pool) => ({
            pool,
            phaseId: phase.id,
            phaseName: phase.name,
            matches: (byPool.get(pool.id) ?? []).filter((match) =>
              matchMatchesQuery(match, query, phaseGroupLabel(pool), phase.name),
            ),
          })),
      );
  }, [division.phases, matches, scopePhaseId, scopePoolId, query, searching]);

  const visibleMatches = useMemo(() => groups.flatMap((group) => group.matches), [groups]);

  /* The open match is part of the address, so a link to a match survives a
     refresh and can be handed to someone else. */
  const requestedMatchId = Number(searchParams.get("match")) || null;
  const selectedMatch =
    visibleMatches.find((match) => match.id === requestedMatchId) ?? visibleMatches[0] ?? null;

  useEffect(() => {
    if (!selectedMatch || selectedMatch.id === requestedMatchId) return;
    const next = new URLSearchParams(searchParams);
    next.set("match", String(selectedMatch.id));
    setSearchParams(next, { replace: true });
  }, [selectedMatch, requestedMatchId, searchParams, setSearchParams]);

  /* A route row in the open card points at the match it advances from. That
     match can be anywhere in the list, so it is scrolled to rather than just
     recoloured. */
  const routedRowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!highlight.matchId) return;
    routedRowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [highlight.matchId]);

  /* A pool's advancement rules are a destination of their own, addressed by a
     search parameter so the tree's menu can link straight to them. */
  const editingAdvancement = searchParams.get("edit") === "advancement";
  const scopedPool = scopePoolId
    ? (division.phases ?? []).flatMap((phase) => phase.phaseGroups ?? []).find((pool) => pool.id === scopePoolId)
    : undefined;

  return {
    division,
    entrants,
    tournamentId,
    controls,
    matches,
    actions,
    matchCreation,
    groups,
    query,
    searching,
    highlight,
    selectedMatch,
    routedRowRef,
    totalInScope: visibleMatches.length,
    createTargetPool: scopePoolId ?? groups[0]?.pool.id ?? undefined,
    createTargetPhase: scopePhaseId ?? groups[0]?.phaseId ?? undefined,
    scopePoolId,
    advancementEditorPool: editingAdvancement ? scopedPool : undefined,
    setQuery,
    setHighlight,
    commitMatch: (match: Match) => actions.commitMatchResult(match.id),
    selectMatch: (matchId: number) => {
      const next = new URLSearchParams(searchParams);
      next.set("match", String(matchId));
      setSearchParams(next, { replace: true });
      setHighlight({ matchId: null, phaseGroupId: null });
    },
    closeAdvancement: () => {
      const next = new URLSearchParams(searchParams);
      next.delete("edit");
      setSearchParams(next, { replace: true });
    },
  };
}
