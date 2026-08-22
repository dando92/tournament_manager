import CreateDivisionModal from "@/features/division/modals/CreateDivisionModal";
import CreatePhaseModal from "@/features/division/modals/CreatePhaseModal";
import GenerateBracketModal from "@/features/division/modals/GenerateBracketModal";
import StartggImportModal from "@/features/tournament/modals/StartggImportModal";
import RenameModal from "@/shared/components/ui/RenameModal";
import { useTournamentTree } from "@/features/tournament/context/TournamentTreeContext";
import { useTournamentStructureDialogs } from "@/features/tournament/hooks/useTournamentStructureDialogs";

/**
 * The dialogs that change the shape of a tournament.
 *
 * They live beside the structure provider rather than inside a page because
 * the tree's context menu is what opens them, and the tree outlives any page.
 * Each one closes by clearing the provider's single `dialog` value, so two can
 * never be open at once.
 */
export default function TournamentStructureModals() {
  const tree = useTournamentTree();
  const { dialog, closeDialog, tournamentId, tournamentName, divisions } = tree;
  const { bracketTypes, handleGenerateBracket } = useTournamentStructureDialogs();

  return (
    <>
      <CreateDivisionModal
        open={dialog.kind === "createDivision"}
        onClose={closeDialog}
        onCreate={(name) => {
          void tree.addDivision(name);
        }}
      />

      <CreatePhaseModal
        open={dialog.kind === "createPhase"}
        onClose={closeDialog}
        divisions={divisions.map((division) => ({ id: division.id, name: division.name }))}
        divisionId={dialog.kind === "createPhase" ? dialog.divisionId : undefined}
        onCreate={(name, divisionId) => {
          void tree.addPhase(divisionId, name);
          closeDialog();
        }}
      />

      <GenerateBracketModal
        open={dialog.kind === "generateBracket"}
        onClose={closeDialog}
        divisions={divisions}
        currentDivisionId={dialog.kind === "generateBracket" ? dialog.divisionId : undefined}
        bracketTypes={bracketTypes}
        onGenerate={handleGenerateBracket}
      />

      <StartggImportModal
        open={dialog.kind === "startggImport"}
        onClose={closeDialog}
        fixedTournamentId={tournamentId ?? undefined}
        fixedTournamentName={tournamentName}
        onImported={async () => {
          await tree.refreshTree();
        }}
      />

      <RenameModal
        open={dialog.kind === "rename"}
        noun={dialog.kind === "rename" ? dialog.noun : ""}
        currentName={dialog.kind === "rename" ? dialog.currentName : ""}
        onClose={closeDialog}
        onRename={(name) => {
          if (dialog.kind !== "rename") return;
          void dialog.apply(name);
        }}
      />
    </>
  );
}
