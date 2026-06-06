import MatchList from "@/features/match/components/MatchList";
import PhaseGroupRow from "@/features/division/components/PhaseGroupRow";
import { Division } from "@/features/division/types/Division";
import { Phase } from "@/features/division/types/Phase";
import { MatchHighlight, MatchState } from "@/features/match/types/Match";

type PhaseMatchesPanelProps = {
  phase: Phase;
  division: Division;
  controls: boolean;
  tournamentId?: number;
  matchRefreshKey?: number;
  matchStateFilter?: MatchState | "all";
  highlight: MatchHighlight;
  onHighlight: (highlight: MatchHighlight) => void;
  autoExpandSinglePhaseGroup?: boolean;
  onChanged?: () => Promise<void>;
};

export default function PhaseMatchesPanel({
  phase,
  division,
  controls,
  tournamentId,
  matchRefreshKey,
  matchStateFilter = "all",
  highlight,
  onHighlight,
  autoExpandSinglePhaseGroup = false,
  onChanged,
}: PhaseMatchesPanelProps) {
  const matchCount = phase.matchCount ?? phase.matches?.length ?? 0;
  const phaseGroups = phase.phaseGroups ?? [];
  const shouldUsePhaseGroups = phaseGroups.length > 0;
  const expandSingleGroup = autoExpandSinglePhaseGroup && phaseGroups.length === 1;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <h4 className="text-sm font-semibold text-gray-700">{phase.name}</h4>
        <span className="text-xs text-gray-400">
          {matchCount} match{matchCount !== 1 ? "es" : ""}
        </span>
      </div>
      {shouldUsePhaseGroups ? (
        <div className="flex flex-col gap-3">
          {phaseGroups.map((phaseGroup) => (
            <PhaseGroupRow
              key={phaseGroup.id}
              phase={phase}
              phaseGroup={phaseGroup}
              division={division}
              controls={controls}
              tournamentId={tournamentId}
              matchRefreshKey={matchRefreshKey}
              matchStateFilter={matchStateFilter}
              highlight={highlight}
              onHighlight={onHighlight}
              defaultExpanded={expandSingleGroup}
              onChanged={onChanged}
            />
          ))}
        </div>
      ) : (
        <MatchList
          key={`phase-${phase.id}`}
          division={division}
          controls={controls}
          tournamentId={tournamentId}
          matchUpdateSignal={matchRefreshKey}
          matchStateFilter={matchStateFilter}
          highlight={highlight}
          onHighlight={onHighlight}
        />
      )}
    </div>
  );
}
