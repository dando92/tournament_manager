import CreateDivisionModal from "@/features/division/modals/CreateDivisionModal";
import CreatePhaseModal from "@/features/division/modals/CreatePhaseModal";
import CreatePhaseGroupModal from "@/features/division/modals/CreatePhaseGroupModal";
import GenerateBracketModal from "@/features/division/modals/GenerateBracketModal";
import StartggImportModal from "@/features/tournament/modals/StartggImportModal";
import { TournamentPageContextValue } from "@/features/tournament/context/TournamentPageContext";
import { GenerateBracketRequest, TournamentPageState } from "@/features/tournament/hooks/useTournamentPage";

type TournamentManagementModalsProps = {
  context: TournamentPageContextValue;
  state: TournamentPageState;
  currentDivisionId?: number;
  currentPhaseId?: number;
  onCreatePhase: (name: string, divisionId: number) => Promise<void>;
  onCreatePhaseGroup: (name: string, phaseId: number) => Promise<void>;
  onGenerateBracket: (request: GenerateBracketRequest) => Promise<void>;
};

export default function TournamentManagementModals({
  context,
  state,
  currentDivisionId,
  currentPhaseId,
  onCreatePhase,
  onCreatePhaseGroup,
  onGenerateBracket,
}: TournamentManagementModalsProps) {
  const currentDivision = state.divisions.find((division) => division.id === currentDivisionId);

  return (
    <>
      <CreateDivisionModal
        open={state.createDivisionOpen}
        onClose={() => state.setCreateDivisionOpen(false)}
        onCreate={state.handleCreateDivision}
      />
      <CreatePhaseModal
        open={state.createPhaseOpen}
        onClose={() => state.setCreatePhaseOpen(false)}
        divisions={state.divisions.map((division) => ({ id: division.id, name: division.name }))}
        divisionId={currentDivisionId}
        onCreate={onCreatePhase}
      />
      <CreatePhaseGroupModal
        open={state.createPhaseGroupOpen}
        onClose={() => state.setCreatePhaseGroupOpen(false)}
        phases={(currentDivision?.phases ?? []).map((phase) => ({ id: phase.id, name: phase.name }))}
        phaseId={currentPhaseId}
        onCreate={onCreatePhaseGroup}
      />
      <GenerateBracketModal
        open={state.generateBracketOpen}
        onClose={() => state.setGenerateBracketOpen(false)}
        divisions={state.divisions}
        currentDivisionId={currentDivisionId}
        bracketTypes={state.bracketTypes}
        onGenerate={onGenerateBracket}
      />
      <StartggImportModal
        open={context.participantsManageModal === "startgg"}
        onClose={() => context.setParticipantsManageModal("none")}
        fixedTournamentId={context.tournamentId}
        fixedTournamentName={context.tournamentName}
        onImported={async () => {
          await context.refreshDivisions();
        }}
      />
    </>
  );
}
