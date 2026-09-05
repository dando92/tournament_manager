import { useEffect, useMemo, useState } from "react";

import { findingsOf } from "@/features/stats/model/findings";
import { useTournamentStats } from "@/features/stats/model/useTournamentStats";
import DifficultyScatter from "@/features/stats/ui/DifficultyScatter";
import DivisionTabs from "@/features/stats/ui/DivisionTabs";
import FindingsStrip from "@/features/stats/ui/FindingsStrip";
import PlacementsTable from "@/features/stats/ui/PlacementsTable";
import PlayerStatsTable from "@/features/stats/ui/PlayerStatsTable";
import Podium from "@/features/stats/ui/Podium";
import SongStatsTable from "@/features/stats/ui/SongStatsTable";
import SpreadList from "@/features/stats/ui/SpreadList";
import StatsSection from "@/features/stats/ui/StatsSection";
import { useTournamentPageContext } from "@/features/tournament/model/TournamentPageContext";

/**
 * The tournament's numbers, read once it has happened.
 *
 * FQ-016 held this page empty until somebody had asked a question, and these are
 * the three that were asked: where everybody finished, what each player did, and
 * how the pool of songs actually played. One at a time, because they are three
 * questions rather than one long page.
 *
 * Nothing here is live — the answers are for competitors and organisers after
 * the event, which is also why no read on this page subscribes to updates.
 */

type Tab = "placements" | "players" | "songs";

const TABS: ReadonlyArray<{ key: Tab; label: string }> = [
  { key: "placements", label: "Placements" },
  { key: "players", label: "Players" },
  { key: "songs", label: "Songs" },
];

export default function StatsPage() {
  const { tournamentId, tournamentName } = useTournamentPageContext();
  const { placements, players, songs } = useTournamentStats(tournamentId);
  const [tab, setTab] = useState<Tab>("placements");
  const [divisionId, setDivisionId] = useState<number | null>(null);

  const divisions = useMemo(() => placements.data ?? [], [placements.data]);

  /* The first finished division is the one worth opening on; failing that, the
     first there is, so the page never lands on an empty tab by default. */
  useEffect(() => {
    if (divisionId !== null && divisions.some((division) => division.divisionId === divisionId)) {
      return;
    }
    const opening = divisions.find((division) => division.complete) ?? divisions[0];
    setDivisionId(opening?.divisionId ?? null);
  }, [divisions, divisionId]);

  const selected = divisions.find((division) => division.divisionId === divisionId) ?? null;
  const findings = useMemo(() => findingsOf(players.data ?? [], songs.data ?? [], divisions), [players.data, songs.data, divisions]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 py-2">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-ui-text-mute">{tournamentName}</span>
          <h1 className="text-2xl font-bold tracking-tight text-ui-text">Statistics</h1>
        </div>
        <div className="flex gap-1 rounded-xl border border-ui-border bg-ui-raised p-1">
          {TABS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => setTab(entry.key)}
              aria-pressed={tab === entry.key}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                tab === entry.key ? "bg-ui-surface text-ui-text shadow-sm" : "text-ui-text-mute hover:text-ui-text"
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "placements" ? (
        <StatsSection
          title="Final placements"
          description="Read back off the advancement rules. Entrants the tournament never separated share a place."
          loading={placements.isLoading}
          error={placements.isError}
          empty={divisions.length === 0}
        >
          <div className="flex flex-col gap-5">
            <DivisionTabs divisions={divisions} selectedId={divisionId} onSelect={setDivisionId} />
            {selected ? (
              <>
                {selected.complete ? <Podium rows={selected.rows} /> : null}
                <PlacementsTable division={selected} />
              </>
            ) : null}
          </div>
        </StatsSection>
      ) : null}

      {tab === "players" ? (
        <div className="flex flex-col gap-6">
          <StatsSection
            title="What the numbers turned up"
            description="Findings rather than counters: each one names somebody."
            loading={players.isLoading || placements.isLoading}
            error={players.isError}
            empty={(players.data ?? []).length === 0}
          >
            <FindingsStrip findings={findings} />
          </StatsSection>
          <StatsSection
            title="Players"
            description="Every run recorded in this tournament, by the person who played it."
            loading={players.isLoading}
            error={players.isError}
            empty={(players.data ?? []).length === 0}
          >
            <PlayerStatsTable rows={players.data ?? []} />
          </StatsSection>
        </div>
      ) : null}

      {tab === "songs" ? (
        <StatsSection
          title="Songs"
          description="What the pool was worth: the difficulty each song declares against how the field actually scored on it."
          loading={songs.isLoading}
          error={songs.isError}
          empty={(songs.data ?? []).length === 0}
        >
          <div className="flex flex-col gap-5">
            <div className="grid gap-4 lg:grid-cols-[1.9fr_1fr]">
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-ui-text">Declared difficulty against how it actually played</h3>
                <DifficultyScatter rows={songs.data ?? []} />
              </div>
              <div className="flex flex-col gap-3 rounded-xl border border-ui-border bg-ui-surface p-4">
                <h3 className="text-sm font-semibold text-ui-text">Songs that decided something</h3>
                <p className="-mt-1 text-xs leading-snug text-ui-text-mute">
                  Ranked by how far apart they pulled the field. A song everybody passed alike decided nothing, however hard it was.
                </p>
                <SpreadList rows={songs.data ?? []} />
              </div>
            </div>
            <SongStatsTable rows={songs.data ?? []} />
          </div>
        </StatsSection>
      ) : null}
    </div>
  );
}
