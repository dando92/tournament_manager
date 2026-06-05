import MatchList from "@/features/match/components/MatchList";
import PhaseGroupRow from "@/features/division/components/PhaseGroupRow";
import { Division } from "@/features/division/types/Division";
import { Phase } from "@/features/division/types/Phase";
import { MatchState } from "@/features/match/types/Match";
import DeleteConfirmButton from "@/shared/components/ui/DeleteConfirmButton";
import { createPhaseGroup } from "@/features/division/services/phase-groups.api";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import { toast } from "react-toastify";

type PhaseMatchesPanelProps = {
  phase: Phase;
  division: Division;
  controls: boolean;
  tournamentId?: number;
  matchRefreshKey?: number;
  matchStateFilter?: MatchState | "all";
  onDelete?: (phaseId: number) => Promise<void>;
  onChanged?: () => Promise<void>;
};

export default function PhaseMatchesPanel({
  phase,
  division,
  controls,
  tournamentId,
  matchRefreshKey,
  matchStateFilter = "all",
  onDelete,
  onChanged,
}: PhaseMatchesPanelProps) {
  const matchCount = phase.matchCount ?? phase.matches?.length ?? 0;
  const phaseGroups = phase.phaseGroups ?? [];
  const shouldUsePhaseGroups = phaseGroups.length > 0;
  const expandSingleGroup = phaseGroups.length === 1;
  const nextGroupNumber =
    Math.max(
      0,
      ...phaseGroups.map((phaseGroup) => Number(phaseGroup.displayIdentifier)).filter(Number.isFinite),
    ) + 1;

  const handleCreatePhaseGroup = async () => {
    try {
      await createPhaseGroup(phase.id, {
        name: `Group ${nextGroupNumber}`,
        displayIdentifier: String(nextGroupNumber),
      });
      await onChanged?.();
      toast.success("Phase group created.");
    } catch {
      toast.error("Error creating phase group.");
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <h4 className="text-sm font-semibold text-gray-700">{phase.name}</h4>
        <span className="text-xs text-gray-400">
          {matchCount} match{matchCount !== 1 ? "es" : ""}
        </span>
        {controls && (
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={handleCreatePhaseGroup}
              className="inline-flex items-center gap-1 text-green-700 hover:text-green-900 text-sm font-medium"
            >
              <FontAwesomeIcon icon={faPlus} />
              <span>Phase group</span>
            </button>
            {onDelete && (
              <DeleteConfirmButton
                title="Delete phase"
                onConfirm={() => onDelete(phase.id)}
                className="text-sm"
                confirmMessage={`Delete phase "${phase.name}"?`}
              />
            )}
          </div>
        )}
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
        />
      )}
    </div>
  );
}
