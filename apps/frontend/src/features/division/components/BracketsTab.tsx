import PhaseMatchesPanel from "@/features/division/components/PhaseMatchesPanel";
import PhaseSelector from "@/features/division/components/PhaseSelector";
import { Division } from "@/features/division/types/Division";
import { MatchHighlight } from "@/features/match/types/Match";
import { useBracketsTab } from "@/features/division/hooks/useBracketsTab";
import { useState } from "react";

type BracketsTabProps = {
  division: Division;
  controls: boolean;
  tournamentId?: number;
  onCreatePhase?: () => void;
  onDivisionChanged?: () => Promise<void>;
};

export default function BracketsTab({
  division,
  controls,
  tournamentId,
  onCreatePhase,
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
        onCreate={controls ? onCreatePhase : undefined}
      />

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
                onDeletePhase={() => state.handleDeletePhase(phase.id)}
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
          onDeletePhase={() => state.handleDeletePhase(state.selectedPhase!.id)}
          onChanged={onDivisionChanged}
        />
      ) : (
        <p className="text-center text-gray-400 text-sm py-8">No bracket yet.</p>
      )}
    </div>
  );
}
