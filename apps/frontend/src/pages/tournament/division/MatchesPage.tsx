import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faPlus, faXmark } from "@fortawesome/free-solid-svg-icons";
import { useDivisionMatchesPage } from "@/features/division/model/useDivisionMatchesPage";
import PoolAdvancementEditor from "@/features/division/ui/PoolAdvancementEditor";
import { phaseGroupLabel } from "@/features/division/model/phaseGroupLabel";
import ConnectedMatchCard from "@/features/match/ui/ConnectedMatchCard";
import MatchListRow from "@/features/match/ui/MatchListRow";
import CreateMatchModal from "@/features/match/ui/CreateMatchModal";
import StatusIcon from "@/shared/components/ui/StatusIcon";
import CreateCard from "@/shared/components/ui/CreateCard";
import { poolStatus } from "@/features/tournament/model/treeStatus";
import LiveNowPanel from "@/features/live/ui/LiveNowPanel";
import { btnPrimary } from "@/styles/buttonStyles";

/**
 * Every match under the branch the tree has open, as one flat list.
 *
 * The matches are grouped by pool under sticky headers, so a long scroll never
 * loses track of where it is. The list keeps its own scroll and the card stays
 * anchored below it: with sixty matches, a card at the bottom of the page would
 * mean scrolling back and forth on every selection.
 */

const LIST_MAX_HEIGHT = "max-h-[min(48vh,26rem)]";

export default function DivisionMatchesPage() {
  const page = useDivisionMatchesPage();
  const { division, controls, tournamentId, groups, highlight, selectedMatch, matchCreation } = page;

  if (page.advancementEditorPool) {
    return (
      <PoolAdvancementEditor
        division={division}
        phaseGroup={page.advancementEditorPool}
        allMatches={page.matches}
        onClose={page.closeAdvancement}
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
            value={page.query}
            onChange={(event) => page.setQuery(event.target.value)}
            placeholder="Search match, player, song…"
            aria-label="Search matches"
            className="w-full min-w-0 bg-transparent text-sm text-ui-text outline-none placeholder:text-ui-text-mute"
          />
        </label>

        {page.searching && (
          <span className="inline-flex items-center gap-1 rounded-full border border-ui-border-strong bg-ui-selected py-0.5 pl-3 pr-1 text-xs text-ui-text-soft">
            searching all of {division.name}
            <button
              type="button"
              onClick={() => page.setQuery("")}
              aria-label="Clear search"
              className="rounded-full px-1.5 py-0.5 text-ui-text-mute transition-colors hover:bg-ui-border hover:text-ui-text"
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </span>
        )}

        <span className="text-xs tabular-nums text-ui-text-mute">
          {page.totalInScope} match{page.totalInScope !== 1 ? "es" : ""}
        </span>

        {controls && page.createTargetPool !== undefined && (
          <button type="button" onClick={matchCreation.openCreateMatch} className={`${btnPrimary} ml-auto text-sm`}>
            <FontAwesomeIcon icon={faPlus} className="mr-2 text-xs" />
            New match
          </button>
        )}
      </div>

      {page.totalInScope === 0 ? (
        <EmptyState
          searching={page.searching}
          controls={controls}
          hasPool={groups.length > 0}
          onCreate={matchCreation.openCreateMatch}
        />
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
                    {(groups.length > 1 || page.searching) && (
                      <span className="truncate font-medium normal-case tracking-normal">
                        {division.name} / {group.phaseName}
                      </span>
                    )}
                    <span className="ml-auto font-medium normal-case tracking-normal tabular-nums">
                      {group.matches.length}
                    </span>
                  </header>
                  {group.matches.map((match) => (
                    <div key={match.id} ref={match.id === highlight.matchId ? page.routedRowRef : undefined}>
                      <MatchListRow
                        match={match}
                        selected={match.id === selectedMatch?.id}
                        routed={match.id === highlight.matchId}
                        controls={controls}
                        onSelect={() => page.selectMatch(match.id)}
                        onCommit={() => void page.commitMatch(match)}
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
          divisionEntrants={page.entrants}
          allMatches={page.matches}
          actions={page.actions}
          controls={controls}
          tournamentId={tournamentId}
          highlight={highlight}
          onHighlight={page.setHighlight}
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
        phaseId={page.createTargetPhase}
        phaseGroupId={page.scopePoolId ?? undefined}
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
