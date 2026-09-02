import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GenerateBracketRequest } from "@/features/division/model/types";
import { generateBracket, listBracketTypes } from "@/features/division/api/division.api";
import { useTournamentTree } from "@/features/tournament/model/TournamentTreeContext";
import { treeNodeKey } from "@/shared/lib/treeState";
import { phasePath } from "@/features/tournament/model/treeSelection";

/**
 * What the structural dialogs need beyond the tree itself: the bracket types
 * the API offers, the phase a dialog was opened on, and what happens once a
 * bracket has been generated.
 *
 * The types are read only when the bracket dialog is actually asked for.
 * Nobody needs the list to look at a tournament.
 */
export function useTournamentStructureDialogs() {
  const navigate = useNavigate();
  const tree = useTournamentTree();
  const { dialog, tournamentId } = tree;
  const [bracketTypes, setBracketTypes] = useState<string[]>([]);

  /* Two dialogs act on a phase and both need what it already holds: the pool
     dialog to offer a free name, the bracket dialog to say where it will land. */
  const dialogPhaseId = dialog.kind === "createPool" ? dialog.phaseId : dialog.kind === "generateBracket" ? dialog.phaseId : undefined;
  const dialogPhase = useMemo(
    () =>
      dialogPhaseId === undefined
        ? undefined
        : tree.divisions.flatMap((division) => division.phases).find((phase) => phase.id === dialogPhaseId),
    [tree.divisions, dialogPhaseId],
  );

  useEffect(() => {
    if (dialog.kind !== "generateBracket" || bracketTypes.length > 0) return;
    listBracketTypes()
      .then(setBracketTypes)
      .catch(() => setBracketTypes([]));
  }, [dialog.kind, bracketTypes.length]);

  /**
   * The phase is where a generated bracket is opened, not the pool it built.
   * The phase shows every match under it whether it holds one pool or several,
   * and addressing the pool would name a node the tree may not be drawing.
   */
  async function handleGenerateBracket(request: GenerateBracketRequest) {
    const generated = await generateBracket(request);
    await tree.refreshTree();
    tree.expandNode(treeNodeKey("division", request.divisionId));
    tree.expandNode(treeNodeKey("phase", generated.phaseId));
    navigate(phasePath(tournamentId ?? 0, request.divisionId, generated.phaseId));
  }

  return { bracketTypes, dialogPhase, handleGenerateBracket };
}
