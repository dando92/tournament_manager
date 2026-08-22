import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GenerateBracketRequest } from "@/features/division/model/types";
import { generateBracket, listBracketTypes } from "@/features/division/api/division.api";
import { useTournamentTree } from "@/features/tournament/model/TournamentTreeContext";
import { treeNodeKey } from "@/shared/lib/treeState";

/**
 * What the structural dialogs need beyond the tree itself: the bracket types
 * the API offers, and what happens once a bracket has been generated.
 *
 * The types are read only when the bracket dialog is actually asked for.
 * Nobody needs the list to look at a tournament.
 */
export function useTournamentStructureDialogs() {
  const navigate = useNavigate();
  const tree = useTournamentTree();
  const { dialog, closeDialog, tournamentId } = tree;
  const [bracketTypes, setBracketTypes] = useState<string[]>([]);

  useEffect(() => {
    if (dialog.kind !== "generateBracket" || bracketTypes.length > 0) return;
    listBracketTypes()
      .then(setBracketTypes)
      .catch(() => setBracketTypes([]));
  }, [dialog.kind, bracketTypes.length]);

  async function handleGenerateBracket(request: GenerateBracketRequest) {
    const generated = await generateBracket(request);
    await tree.refreshTree();
    closeDialog();
    tree.expandNode(treeNodeKey("division", request.divisionId));
    tree.expandNode(treeNodeKey("phase", generated.phaseId));
    navigate(
      `/tournament/${tournamentId}/division/${request.divisionId}/phase/${generated.phaseId}/pool/${generated.phaseGroupId}`,
    );
  }

  return { bracketTypes, handleGenerateBracket };
}
