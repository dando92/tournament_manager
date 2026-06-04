import { useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight, faChevronDown, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import MatchList from "@/features/match/components/MatchList";
import { Division } from "@/features/division/types/Division";
import { Phase, PhaseGroup } from "@/features/division/types/Phase";
import { MatchState } from "@/features/match/types/Match";
import DeleteConfirmButton from "@/shared/components/ui/DeleteConfirmButton";

type PhaseGroupRowProps = {
  phase: Phase;
  phaseGroup: PhaseGroup;
  division: Division;
  controls: boolean;
  tournamentId?: number;
  matchRefreshKey?: number;
  matchStateFilter?: MatchState | "all";
  defaultExpanded?: boolean;
  hiddenChrome?: boolean;
  onDeletePhase?: (phaseId: number) => Promise<void>;
};

const entrantPreviewLimit = 8;

export default function PhaseGroupRow({
  phase,
  phaseGroup,
  division,
  controls,
  tournamentId,
  matchRefreshKey,
  matchStateFilter = "all",
  defaultExpanded = false,
  hiddenChrome = false,
  onDeletePhase,
}: PhaseGroupRowProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const entrants = useMemo(
    () =>
      [...(phaseGroup.entrants ?? [])].sort((left, right) => {
        const leftAdvanced = left.status === "advanced" ? 0 : 1;
        const rightAdvanced = right.status === "advanced" ? 0 : 1;
        return leftAdvanced - rightAdvanced || (left.seedNum ?? Number.MAX_SAFE_INTEGER) - (right.seedNum ?? Number.MAX_SAFE_INTEGER);
      }),
    [phaseGroup.entrants],
  );
  const previewEntrants = entrants.slice(0, entrantPreviewLimit);
  const hiddenCount = Math.max(0, entrants.length - previewEntrants.length);

  const content = (
    <MatchList
      key={`phase-group-${phaseGroup.id}`}
      division={division}
      phaseId={phase.id}
      phaseGroupId={phaseGroup.id}
      controls={controls}
      tournamentId={tournamentId}
      matchUpdateSignal={matchRefreshKey}
      matchStateFilter={matchStateFilter}
    />
  );

  if (hiddenChrome) {
    return content;
  }

  return (
    <div className="border border-gray-200 rounded-md bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors"
      >
        <FontAwesomeIcon icon={expanded ? faChevronDown : faChevronRight} className="text-gray-500 w-3 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-800">{phaseGroup.name}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{phaseGroup.state}</span>
            <span className="text-xs text-gray-400">
              {phaseGroup.matchCount} match{phaseGroup.matchCount !== 1 ? "es" : ""}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            {previewEntrants.length === 0 ? (
              <span className="text-xs text-gray-400">No entrants assigned</span>
            ) : (
              previewEntrants.map((phaseGroupEntrant) => (
                <span
                  key={phaseGroupEntrant.id}
                  className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                >
                  {phaseGroupEntrant.status === "advanced" && (
                    <FontAwesomeIcon icon={faArrowRight} className="text-emerald-600" />
                  )}
                  {phaseGroupEntrant.entrant.name}
                </span>
              ))
            )}
            {hiddenCount > 0 && <span className="text-xs text-gray-400">+{hiddenCount} more</span>}
          </div>
        </div>
        {controls && onDeletePhase && (
          <div onClick={(event) => event.stopPropagation()}>
            <DeleteConfirmButton
              title="Delete phase"
              onConfirm={() => onDeletePhase(phase.id)}
              className="text-sm"
              confirmMessage={`Delete phase "${phase.name}"?`}
            />
          </div>
        )}
      </button>
      {expanded && <div className="px-4 pb-4 border-t border-gray-100">{content}</div>}
    </div>
  );
}
