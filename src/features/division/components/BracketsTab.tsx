import PhaseMatchesPanel from "@/features/division/components/PhaseMatchesPanel";
import PhaseSelector from "@/features/division/components/PhaseSelector";
import { Division } from "@/features/division/types/Division";
import { MatchHighlight, MatchState } from "@/features/match/types/Match";
import { useBracketsTab } from "@/features/division/hooks/useBracketsTab";
import { useState } from "react";
import DeleteConfirmButton from "@/shared/components/ui/DeleteConfirmButton";

type BracketsTabProps = {
  division: Division;
  controls: boolean;
  tournamentId?: number;
  matchRefreshKey?: number;
  onDivisionChanged?: () => Promise<void>;
};

export default function BracketsTab({
  division,
  controls,
  tournamentId,
  matchRefreshKey,
  onDivisionChanged,
}: BracketsTabProps) {
  const state = useBracketsTab({ division, onDivisionChanged });
  const [matchStateFilter, setMatchStateFilter] = useState<MatchState | "all">("all");
  const [highlight, setHighlight] = useState<MatchHighlight>({ matchId: null, phaseGroupId: null });

  return (
    <div className="flex flex-col gap-4">
      <PhaseSelector
        phases={state.phases}
        selectedPhaseId={state.selectedPhaseId}
        onSelect={state.setSelectedPhaseId}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <MatchStateFilter value={matchStateFilter} onChange={setMatchStateFilter} />
        {controls && state.selectedPhase && (
          <DeleteConfirmButton
            title="Delete phase"
            onConfirm={() => state.handleDeletePhase(state.selectedPhase!.id)}
            className="flex items-center gap-2 rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
            iconClassName="w-3"
            confirmMessage={`Delete phase "${state.selectedPhase.name}"?`}
          >
            Delete phase
          </DeleteConfirmButton>
        )}
      </div>

      {state.selectedPhaseId === "all" ? (
        state.phases.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">No bracket yet.</p>
        ) : (
          <div className="flex flex-col gap-5">
            {state.phases.map((phase) => (
              <PhaseMatchesPanel
                key={phase.id}
                phase={phase}
                division={division}
                controls={controls}
                tournamentId={tournamentId}
                matchRefreshKey={matchRefreshKey}
                matchStateFilter={matchStateFilter}
                highlight={highlight}
                onHighlight={setHighlight}
                autoExpandSinglePhaseGroup={false}
                onChanged={onDivisionChanged}
              />
            ))}
          </div>
        )
      ) : state.selectedPhase ? (
        <PhaseMatchesPanel
          phase={state.selectedPhase}
          division={division}
          controls={controls}
          tournamentId={tournamentId}
          matchRefreshKey={matchRefreshKey}
          matchStateFilter={matchStateFilter}
          highlight={highlight}
          onHighlight={setHighlight}
          onChanged={onDivisionChanged}
        />
      ) : (
        <p className="text-center text-gray-400 text-sm py-8">No bracket yet.</p>
      )}
    </div>
  );
}

type MatchStateFilterProps = {
  value: MatchState | "all";
  onChange: (value: MatchState | "all") => void;
};

const matchStateOptions: Array<{ value: MatchState | "all"; label: string }> = [
  { value: "all", label: "All states" },
  { value: "NotActive", label: "Not active" },
  { value: "Active", label: "Active" },
  { value: "Pending", label: "Pending" },
  { value: "Completed", label: "Completed" },
];

function MatchStateFilter({ value, onChange }: MatchStateFilterProps) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="match-state-filter" className="text-sm font-medium text-gray-700">
        Match state
      </label>
      <select
        id="match-state-filter"
        value={value}
        onChange={(event) => onChange(event.target.value as MatchState | "all")}
        className="px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 bg-white focus:outline-none focus:ring-primary-dark focus:border-primary-dark"
      >
        {matchStateOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
