import PhaseMatchesPanel from "@/features/division/components/PhaseMatchesPanel";
import PhaseSelector from "@/features/division/components/PhaseSelector";
import { Division } from "@/features/division/types/Division";
import { MatchHighlight } from "@/features/match/types/Match";
import { useBracketsTab } from "@/features/division/hooks/useBracketsTab";
import { useState } from "react";
import DeleteConfirmButton from "@/shared/components/ui/DeleteConfirmButton";

type BracketsTabProps = {
  division: Division;
  controls: boolean;
  tournamentId?: number;
  onDivisionChanged?: () => Promise<void>;
};

export default function BracketsTab({
  division,
  controls,
  tournamentId,
  onDivisionChanged,
}: BracketsTabProps) {
  const state = useBracketsTab({ division, onDivisionChanged });
  const [highlight, setHighlight] = useState<MatchHighlight>({ matchId: null, phaseGroupId: null });

  return (
    <div className="flex flex-col gap-4">
      <PhaseSelector
        phases={state.phases}
        selectedPhaseId={state.selectedPhaseId}
        onSelect={state.setSelectedPhaseId}
      />

      {controls && state.selectedPhase && (
        <div className="flex justify-end">
          <DeleteConfirmButton
            title="Delete phase"
            onConfirm={() => state.handleDeletePhase(state.selectedPhase!.id)}
            className="flex items-center gap-2 rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
            iconClassName="w-3"
            confirmMessage={`Delete phase "${state.selectedPhase.name}"?`}
          >
            Delete phase
          </DeleteConfirmButton>
        </div>
      )}

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
                highlight={highlight}
                onHighlight={setHighlight}
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
