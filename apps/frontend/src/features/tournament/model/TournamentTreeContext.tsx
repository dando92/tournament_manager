import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { TournamentDivisionOption } from "@/features/tournament/model/types";
import { useTournamentOverviewQuery } from "@/features/tournament/model/useTournamentOverviewQuery";
import { tournamentKeys } from "@/features/tournament/api/tournament.keys";
import { createDivision, deleteDivision, renameDivision } from "@/features/division/api/division.api";
import { createPhase, deletePhase, updatePhase } from "@/features/division/api/phase.api";
import { createPhaseGroup, deletePhaseGroup, updatePhaseGroup } from "@/features/division/api/phase-group.api";
import {
  getCollapsedTournamentSections,
  getExpandedNodes,
  setCollapsedTournamentSections,
  setExpandedNodes,
  treeNodeKey,
  type TournamentSectionKey,
} from "@/shared/lib/treeState";
import TournamentStructureModals from "@/features/tournament/ui/tree/TournamentStructureModals";

/**
 * The tournament's structure: what it holds, what is open in the tree, and
 * every operation that changes its shape.
 *
 * It is provided above the page outlet rather than inside it because the tree
 * is a sibling of the outlet, not a descendant — the sidebar could not read a
 * context the page provides. Keeping the mutations here too means the tree's
 * context menu and any page act through one implementation instead of two that
 * drift.
 *
 * This provider loads the tournament currently in page scope. The sidebar may
 * independently preview one other tournament through the same query cache;
 * selecting a destination then moves page scope to it.
 *
 * The glyphs the tree draws are derived from this structure, so they have to
 * follow the live ones. Nothing here arranges that: `TournamentUpdatesProvider`
 * invalidates the overview query when an event says the tree moved, and the
 * mutations below rely on the same path rather than re-reading by hand. That is
 * why each one only awaits its write — the redraw is not theirs to trigger.
 */

export type StructureDialog =
  | { kind: "none" }
  | { kind: "createDivision" }
  | { kind: "createPhase"; divisionId?: number }
  | { kind: "createPool"; phaseId: number }
  | { kind: "generateBracket"; divisionId?: number; phaseId?: number }
  | { kind: "startggImport" }
  | { kind: "rename"; noun: string; currentName: string; apply: (name: string) => Promise<void> };

type TournamentTreeContextValue = {
  tournamentId: number | null;
  tournamentName: string;
  controls: boolean;
  divisions: TournamentDivisionOption[];
  loading: boolean;
  refreshTree: () => Promise<void>;

  isExpanded: (key: string) => boolean;
  toggleNode: (key: string, deep?: boolean) => void;
  expandNode: (key: string) => void;
  expandNodes: (keys: string[]) => void;
  collapseAll: () => void;
  isTournamentSectionCollapsed: (key: TournamentSectionKey) => boolean;
  toggleTournamentSection: (key: TournamentSectionKey) => void;

  dialog: StructureDialog;
  openDialog: (dialog: StructureDialog) => void;
  closeDialog: () => void;

  createPool: (phaseId: number, name: string) => Promise<void>;
  removeDivision: (divisionId: number) => Promise<void>;
  removePhase: (phaseId: number) => Promise<void>;
  removePool: (phaseGroupId: number) => Promise<void>;
  renameDivisionNode: (divisionId: number, name: string) => Promise<void>;
  renamePhaseNode: (phaseId: number, name: string) => Promise<void>;
  renamePoolNode: (phaseGroupId: number, name: string) => Promise<void>;
  addDivision: (name: string) => Promise<void>;
  addPhase: (divisionId: number, name: string) => Promise<void>;
};

const defaultValue: TournamentTreeContextValue = {
  tournamentId: null,
  tournamentName: "",
  controls: false,
  divisions: [],
  loading: false,
  refreshTree: async () => {},
  isExpanded: () => false,
  toggleNode: () => {},
  expandNode: () => {},
  expandNodes: () => {},
  collapseAll: () => {},
  isTournamentSectionCollapsed: () => false,
  toggleTournamentSection: () => {},
  dialog: { kind: "none" },
  openDialog: () => {},
  closeDialog: () => {},
  createPool: async () => {},
  removeDivision: async () => {},
  removePhase: async () => {},
  removePool: async () => {},
  renameDivisionNode: async () => {},
  renamePhaseNode: async () => {},
  renamePoolNode: async () => {},
  addDivision: async () => {},
  addPhase: async () => {},
};

const TournamentTreeContext = createContext<TournamentTreeContextValue>(defaultValue);

export function TournamentTreeProvider({
  tournamentId,
  tournamentName,
  controls,
  children,
}: {
  tournamentId: number | null;
  tournamentName: string;
  controls: boolean;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const query = useTournamentOverviewQuery(tournamentId);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(getExpandedNodes);
  const [collapsedTournamentSections, setCollapsedTournamentSectionsState] = useState<ReadonlySet<TournamentSectionKey>>(getCollapsedTournamentSections);
  const [dialog, setDialog] = useState<StructureDialog>({ kind: "none" });

  const divisions = useMemo(() => query.data ?? [], [query.data]);

  /**
   * Re-reads the tree now.
   *
   * The mutations below do not use it: their events refresh the tree by
   * themselves. Bracket generation does, because it navigates into the phase and
   * pool it just built and cannot arrive before the tree holds them.
   */
  const refreshTree = useCallback(async () => {
    if (tournamentId === null) return;
    await queryClient.invalidateQueries({ queryKey: tournamentKeys.overview(tournamentId) });
  }, [queryClient, tournamentId]);

  /* ---- expand state ---- */

  /* Persisting in an effect rather than inside each mutator is what lets every
     mutator below be a functional update. That matters: opening a deep link
     expands tournament, division and phase in one pass, and three updates each
     built from the same captured set would keep only the last one. */
  const firstPersist = useRef(true);
  useEffect(() => {
    if (firstPersist.current) {
      firstPersist.current = false;
      return;
    }
    setExpandedNodes(expanded);
  }, [expanded]);

  useEffect(() => {
    setCollapsedTournamentSections(collapsedTournamentSections);
  }, [collapsedTournamentSections]);

  const isExpanded = useCallback((key: string) => expanded.has(key), [expanded]);

  /** Every descendant branch of a node, for the alt-click deep toggle. */
  const descendantKeys = useCallback(
    (key: string): string[] => {
      const [kind, rawId] = key.split(":");
      const id = Number(rawId);
      if (kind === "tournament") {
        return divisions.flatMap((division) => [
          treeNodeKey("division", division.id),
          ...division.phases.map((phase) => treeNodeKey("phase", phase.id)),
        ]);
      }
      if (kind === "division") {
        const division = divisions.find((candidate) => candidate.id === id);
        return (division?.phases ?? []).map((phase) => treeNodeKey("phase", phase.id));
      }
      return [];
    },
    [divisions],
  );

  const toggleNode = useCallback(
    (key: string, deep = false) => {
      setExpanded((current) => {
        const opening = !current.has(key);
        const keys = deep ? [key, ...descendantKeys(key)] : [key];
        const next = new Set(current);
        keys.forEach((candidate) => (opening ? next.add(candidate) : next.delete(candidate)));
        return next;
      });
    },
    [descendantKeys],
  );

  /** Opens several branches at once, so a deep link arrives with its whole path open. */
  const expandNodes = useCallback((keys: string[]) => {
    setExpanded((current) => {
      if (keys.every((key) => current.has(key))) return current;
      const next = new Set(current);
      keys.forEach((key) => next.add(key));
      return next;
    });
  }, []);

  const expandNode = useCallback((key: string) => expandNodes([key]), [expandNodes]);

  const isTournamentSectionCollapsed = useCallback(
    (key: TournamentSectionKey) => collapsedTournamentSections.has(key),
    [collapsedTournamentSections],
  );

  const toggleTournamentSection = useCallback((key: TournamentSectionKey) => {
    setCollapsedTournamentSectionsState((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => {
    setExpanded(new Set());
    setCollapsedTournamentSectionsState(new Set(["pinned", "recent"]));
  }, []);

  /* ---- structural mutations ----
     None of these draws its own result. The server decides what a phase or a
     pool is called when the request omits it, and it announces the tree it
     produced; the listener invalidates the overview, and the tree redraws from
     the same read everybody else gets.

     The ones a dialog drives — creating and renaming — do not report anything
     of their own: the tree redrawing is the confirmation, and a failure is let
     out so the dialog that asked can stay open and say so. `run` is for the
     mutations invoked straight from the tree, which have no dialog to hold the
     answer. */

  const run = useCallback(
    async (work: () => Promise<void>, success: string, failure: string) => {
      try {
        await work();
        toast.success(success);
      } catch {
        toast.error(failure);
      }
    },
    [],
  );

  const addDivision = useCallback(
    async (name: string) => {
      if (tournamentId === null) throw new Error("No tournament is open.");
      await createDivision(tournamentId, name);
    },
    [tournamentId],
  );

  const addPhase = useCallback(
    async (divisionId: number, name: string) => {
      await createPhase(divisionId, name);
      expandNode(treeNodeKey("division", divisionId));
    },
    [expandNode],
  );

  const createPool = useCallback(
    async (phaseId: number, name: string) => {
      await createPhaseGroup(phaseId, { name, displayIdentifier: name });
      expandNode(treeNodeKey("phase", phaseId));
    },
    [expandNode],
  );

  const removeDivision = useCallback(
    async (divisionId: number) => {
      await run(
        async () => {
          await deleteDivision(divisionId);
        },
        "Division deleted.",
        "Error deleting division.",
      );
      if (tournamentId !== null) navigate(`/tournament/${tournamentId}/schedule`);
    },
    [run, navigate, tournamentId],
  );

  const removePhase = useCallback(
    async (phaseId: number) => {
      await run(
        async () => {
          await deletePhase(phaseId);
        },
        "Phase deleted.",
        "Error deleting phase.",
      );
    },
    [run],
  );

  const removePool = useCallback(
    async (phaseGroupId: number) => {
      await run(
        async () => {
          await deletePhaseGroup(phaseGroupId);
        },
        "Pool deleted.",
        "Error deleting pool.",
      );
    },
    [run],
  );

  const renameDivisionNode = useCallback(
    async (divisionId: number, name: string) => {
      await renameDivision(divisionId, name);
    },
    [],
  );

  const renamePhaseNode = useCallback(
    async (phaseId: number, name: string) => {
      await updatePhase(phaseId, { name });
    },
    [],
  );

  const renamePoolNode = useCallback(
    async (phaseGroupId: number, name: string) => {
      await updatePhaseGroup(phaseGroupId, { name, displayIdentifier: name });
    },
    [],
  );

  const openDialog = useCallback((next: StructureDialog) => setDialog(next), []);
  const closeDialog = useCallback(() => setDialog({ kind: "none" }), []);

  const value = useMemo<TournamentTreeContextValue>(
    () => ({
      tournamentId,
      tournamentName,
      controls,
      divisions,
      loading: query.isLoading,
      refreshTree,
      isExpanded,
      toggleNode,
      expandNode,
      expandNodes,
      collapseAll,
      isTournamentSectionCollapsed,
      toggleTournamentSection,
      dialog,
      openDialog,
      closeDialog,
      createPool,
      removeDivision,
      removePhase,
      removePool,
      renameDivisionNode,
      renamePhaseNode,
      renamePoolNode,
      addDivision,
      addPhase,
    }),
    [
      tournamentId,
      tournamentName,
      controls,
      divisions,
      query.isLoading,
      refreshTree,
      isExpanded,
      toggleNode,
      expandNode,
      expandNodes,
      collapseAll,
      isTournamentSectionCollapsed,
      toggleTournamentSection,
      dialog,
      openDialog,
      closeDialog,
      createPool,
      removeDivision,
      removePhase,
      removePool,
      renameDivisionNode,
      renamePhaseNode,
      renamePoolNode,
      addDivision,
      addPhase,
    ],
  );

  return (
    <TournamentTreeContext.Provider value={value}>
      {children}
      <TournamentStructureModals />
    </TournamentTreeContext.Provider>
  );
}

export function useTournamentTree() {
  return useContext(TournamentTreeContext);
}
