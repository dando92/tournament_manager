import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faPlus, faXmark } from "@fortawesome/free-solid-svg-icons";
import { useDivisionPageContext } from "@/features/division/context/DivisionPageContext";
import { PhaseGroup } from "@/features/division/types/Phase";
import ConnectedMatchCard from "@/features/match/components/ConnectedMatchCard";
import MatchListRow from "@/features/match/components/MatchListRow";
import CreateMatchModal from "@/features/match/modals/CreateMatchModal";
import { useCreateMatchAction } from "@/features/match/hooks/useCreateMatchAction";
import { useMatches } from "@/features/match/services/useMatches";
import { Match, MatchHighlight } from "@/features/match/types/Match";
import { matchMatchesQuery } from "@/features/match/utils/matchSearch";
import { buildCommitRequest } from "@/features/match/utils/commitRequest";
import { useManualScoringStore } from "@/features/match/hooks/useManualScoring";
import { clearManualScoring, manualScoringOf } from "@/features/match/services/manualScoring";
import PoolAdvancementEditor from "@/features/division/components/PoolAdvancementEditor";
import { phaseGroupLabel } from "@/features/division/utils/phaseGroupLabel";
import StatusIcon from "@/shared/components/ui/StatusIcon";
import CreateCard from "@/shared/components/ui/CreateCard";
import { poolStatus } from "@/features/tournament/utils/treeStatus";
import LiveNowPanel from "@/features/live/components/LiveNowPanel";
import { btnPrimary } from "@/styles/buttonStyles";

/**
 * Every match under the branch the tree has open, as one flat list.
 *
 * The branch decides the scope — a pool, a phase, or a whole division — and the
 * matches are grouped by pool under sticky headers, so a long scroll never
 * loses track of where it is. The list keeps its own scroll and the card stays
 * anchored below it: with sixty matches, a card at the bottom of the page would
 * mean scrolling back and forth on every selection.
 *
 * Search deliberately ignores the scope and covers the whole division. The
 * question people ask mid-tournament is where a player or a song ended up, and
 * an answer that stops at the open pool does not answer it. The group headers
 * are what make the wider result readable.
 */

const LIST_MAX_HEIGHT = "max-h-[min(48vh,26rem)]";

type PoolGroup = {
  pool: PhaseGroup;
  phaseId: number;
  phaseName: string;
  matches: Match[];
};

export default function DivisionMatchesPage() {
  const { division, tournamentId, controls, refreshDivision } = useDivisionPageContext();
  const { phaseId: phaseIdParam, poolId: poolIdParam } = useParams<{ phaseId?: string; poolId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState<MatchHighlight>({ matchId: null, phaseGroupId: null });
  const { state, actions } = useMatches(division.id);
  /* The list shows commit, so it has to see the hand-scoring drafts the card
     writes — otherwise a match being scored by hand reads as empty here. */
  const manualScoringStore = useManualScoringStore();
  const matchCreation = useCreateMatchAction(async () => {
    await actions.list();
    await refreshDivision();
  });

  const scopePhaseId = phaseIdParam ? Number(phaseIdParam) : null;
  const scopePoolId = poolIdParam ? Number(poolIdParam) : null;
  const searching = query.trim().length > 0;

  /* Pools in scope, each carrying the matches the division-wide list holds for
     it. One request covers every scope, so widening or narrowing the branch
     never costs a round trip. */
  const groups = useMemo<PoolGroup[]>(() => {
    const byPool = new Map<number, Match[]>();
    state.matches.forEach((match) => {
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
  }, [division.phases, state.matches, scopePhaseId, scopePoolId, query, searching]);

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

  const commitMatch = async (match: Match) => {
    await actions.commitMatchResult(match.id, buildCommitRequest(match, manualScoringOf(manualScoringStore, match.id)));
    clearManualScoring(match.id);
  };

  const selectMatch = (matchId: number) => {
    const next = new URLSearchParams(searchParams);
    next.set("match", String(matchId));
    setSearchParams(next, { replace: true });
    setHighlight({ matchId: null, phaseGroupId: null });
  };

  /* A route row in the open card points at the match it advances from. That
     match can be anywhere in the list, so it is scrolled to rather than just
     recoloured. */
  const routedRowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!highlight.matchId) return;
    routedRowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [highlight.matchId]);

  const totalInScope = visibleMatches.length;
  const createTargetPool = scopePoolId ?? groups[0]?.pool.id ?? undefined;
  const createTargetPhase = scopePhaseId ?? groups[0]?.phaseId ?? undefined;

  /* A pool's advancement rules are a destination of their own, addressed by a
     search parameter so the tree's menu can link straight to them. */
  const editingAdvancement = searchParams.get("edit") === "advancement";
  const scopedPool = scopePoolId
    ? (division.phases ?? []).flatMap((phase) => phase.phaseGroups ?? []).find((pool) => pool.id === scopePoolId)
    : undefined;

  const closeAdvancement = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("edit");
    setSearchParams(next, { replace: true });
  };

  if (editingAdvancement && scopedPool) {
    return (
      <PoolAdvancementEditor
        division={division}
        phaseGroup={scopedPool}
        allMatches={state.matches}
        onClose={closeAdvancement}
        onSaved={async () => {
          await actions.list();
          await refreshDivision();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded border border-ui-border bg-ui-canvas px-3 focus-within:border-ui-border-strong sm:max-w-xs">
          <FontAwesomeIcon icon={faMagnifyingGlass} className="shrink-0 text-xs text-ui-text-mute" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search match, player, song…"
            aria-label="Search matches"
            className="w-full min-w-0 bg-transparent text-sm text-ui-text outline-none placeholder:text-ui-text-mute"
          />
        </label>

        {searching && (
          <span className="inline-flex items-center gap-1 rounded-full border border-ui-border-strong bg-ui-selected py-0.5 pl-3 pr-1 text-xs text-ui-text-soft">
            searching all of {division.name}
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="rounded-full px-1.5 py-0.5 text-ui-text-mute transition-colors hover:bg-ui-border hover:text-ui-text"
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </span>
        )}

        <span className="text-xs tabular-nums text-ui-text-mute">
          {totalInScope} match{totalInScope !== 1 ? "es" : ""}
        </span>

        {controls && createTargetPool !== undefined && (
          <button type="button" onClick={matchCreation.openCreateMatch} className={`${btnPrimary} ml-auto text-sm`}>
            <FontAwesomeIcon icon={faPlus} className="mr-2 text-xs" />
            New match
          </button>
        )}
      </div>

      {totalInScope === 0 ? (
        <EmptyState searching={searching} controls={controls} hasPool={groups.length > 0} onCreate={matchCreation.openCreateMatch} />
      ) : (
        <div className={`flex flex-col overflow-hidden rounded-lg border border-ui-border ${LIST_MAX_HEIGHT}`}>
          {/* min-h-0 is what lets a flex child actually scroll instead of growing. */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {groups
              .filter((group) => group.matches.length > 0)
              .map((group) => (
                <section key={group.pool.id}>
                  <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-ui-border bg-ui-raised px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ui-text-mute">
                    <StatusIcon status={poolStatus(group.pool)} className="h-3 w-3" />
                    {phaseGroupLabel(group.pool)}
                    {(groups.length > 1 || searching) && (
                      <span className="truncate font-medium normal-case tracking-normal">
                        {division.name} / {group.phaseName}
                      </span>
                    )}
                    <span className="ml-auto font-medium normal-case tracking-normal tabular-nums">
                      {group.matches.length}
                    </span>
                  </header>
                  {group.matches.map((match) => (
                    <div key={match.id} ref={match.id === highlight.matchId ? routedRowRef : undefined}>
                      <MatchListRow
                        match={match}
                        manualScoring={manualScoringOf(manualScoringStore, match.id)}
                        selected={match.id === selectedMatch?.id}
                        routed={match.id === highlight.matchId}
                        controls={controls}
                        onSelect={() => selectMatch(match.id)}
                        onCommit={() => void commitMatch(match)}
                      />
                    </div>
                  ))}
                </section>
              ))}
          </div>
        </div>
      )}

      {selectedMatch && (
        <ConnectedMatchCard
          key={selectedMatch.id}
          match={selectedMatch}
          division={division}
          allMatches={state.matches}
          actions={actions}
          controls={controls}
          tournamentId={tournamentId}
          highlight={highlight}
          onHighlight={setHighlight}
        />
      )}

      {tournamentId !== undefined && <LiveNowPanel tournamentId={tournamentId} controls={controls} />}

      <CreateMatchModal
        open={matchCreation.createMatchOpen}
        onClose={matchCreation.closeCreateMatch}
        onCreate={async (request) => {
          await matchCreation.createMatch(request);
          matchCreation.closeCreateMatch();
        }}
        divisionId={division.id}
        phaseId={createTargetPhase}
        phaseGroupId={scopePoolId ?? undefined}
        phases={division.phases ?? []}
        tournamentId={tournamentId}
      />
    </div>
  );
}

function EmptyState({
  searching,
  controls,
  hasPool,
  onCreate,
}: {
  searching: boolean;
  controls: boolean;
  hasPool: boolean;
  onCreate: () => void;
}) {
  if (searching) {
    return <p className="py-10 text-center text-sm text-ui-text-mute">No match found.</p>;
  }
  if (!hasPool) {
    return (
      <p className="py-10 text-center text-sm text-ui-text-mute">
        {controls ? "No pool here yet. Right-click a phase in the tree to add one." : "No pool here yet."}
      </p>
    );
  }
  if (!controls) {
    return <p className="py-10 text-center text-sm text-ui-text-mute">No matches yet.</p>;
  }
  return <CreateCard label="Create match" onClick={onCreate} />;
}
