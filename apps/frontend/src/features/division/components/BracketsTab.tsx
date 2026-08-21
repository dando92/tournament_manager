import PhaseActionsMenu from "@/features/division/components/PhaseActionsMenu";
import PhaseBreadcrumb from "@/features/division/components/PhaseBreadcrumb";
import PhaseMatchesPanel from "@/features/division/components/PhaseMatchesPanel";
import { Division } from "@/features/division/types/Division";
import { MatchHighlight } from "@/features/match/types/Match";
import { useBracketsTab } from "@/features/division/hooks/useBracketsTab";
import CreateCard from "@/shared/components/ui/CreateCard";
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
  const selectedPhase = state.selectedPhase;
  const createPhase = controls ? onCreatePhase : undefined;

  return (
    <div className="flex flex-col gap-4">
      <PhaseBreadcrumb
        phases={state.phases}
        selectedPhaseId={state.selectedPhaseId}
        onSelect={state.setSelectedPhaseId}
        onCreate={createPhase}
        rightSlot={
          controls && selectedPhase ? (
            <PhaseActionsMenu phase={selectedPhase} onDelete={() => state.handleDeletePhase(selectedPhase.id)} />
          ) : undefined
        }
      />

      {selectedPhase ? (
        <PhaseMatchesPanel
          variant="focused"
          phase={selectedPhase}
          division={division}
          controls={controls}
          tournamentId={tournamentId}
          highlight={highlight}
          onHighlight={setHighlight}
          onChanged={onDivisionChanged}
        />
      ) : (
        <div className="flex flex-col gap-5">
          {state.phases.map((phase) => (
            <PhaseMatchesPanel
              key={phase.id}
              variant="stacked"
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
          {createPhase ? (
            <CreateCard label="Create phase" onClick={createPhase} />
          ) : (
            state.phases.length === 0 && <p className="py-8 text-center text-sm text-gray-400">No bracket yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
