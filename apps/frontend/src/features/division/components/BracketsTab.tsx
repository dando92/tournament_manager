import PhaseActionsMenu from "@/features/division/components/PhaseActionsMenu";
import PhaseBreadcrumb from "@/features/division/components/PhaseBreadcrumb";
import PhaseMatchesPanel from "@/features/division/components/PhaseMatchesPanel";
import { Division } from "@/features/division/types/Division";
import { useBracketsTab } from "@/features/division/hooks/useBracketsTab";
import { useCreateMatchAction } from "@/features/match/hooks/useCreateMatchAction";
import CreateMatchModal from "@/features/match/modals/CreateMatchModal";
import { MatchHighlight } from "@/features/match/types/Match";
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
  const matchCreation = useCreateMatchAction(onDivisionChanged);
  const selectedPhase = state.selectedPhase;
  const createPhase = controls ? onCreatePhase : undefined;
  const hasPool = state.phases.some((phase) => (phase.phaseGroups ?? []).length > 0);

  return (
    <div className="flex flex-col gap-4">
      <PhaseBreadcrumb
        phases={state.phases}
        selectedPhaseId={state.selectedPhaseId}
        onSelect={state.setSelectedPhaseId}
        onCreate={createPhase}
        rightSlot={
          controls && selectedPhase ? (
            <PhaseActionsMenu
              phase={selectedPhase}
              onDelete={() => state.handleDeletePhase(selectedPhase.id)}
              onChanged={onDivisionChanged}
            />
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
      ) : state.phases.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">No bracket yet.</p>
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
              onChanged={onDivisionChanged}
            />
          ))}
          {controls && hasPool && <CreateCard label="Create match" onClick={matchCreation.openCreateMatch} />}
        </div>
      )}

      <CreateMatchModal
        open={matchCreation.createMatchOpen}
        onClose={matchCreation.closeCreateMatch}
        onCreate={matchCreation.createMatch}
        divisionId={division.id}
        phases={state.phases}
        tournamentId={tournamentId}
      />
    </div>
  );
}
