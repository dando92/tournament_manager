import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faClockRotateLeft,
  faDownload,
  faGear,
  faPenToSquare,
  faPlus,
  faSitemap,
  faThumbtack,
  faTrash,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import TreeNode from "@/features/tournament/ui/tree/TreeNode";
import { DIVISION_TREE_PAGES, TOURNAMENT_TREE_PAGES } from "@/features/tournament/ui/tree/treePages";
import { useTournamentTree } from "@/features/tournament/model/TournamentTreeContext";
import {
  getSidebarTournaments,
  pinTournament,
  removeRecentTournament,
  unpinTournament,
  type RecentTournament,
} from "@/shared/lib/recentTournaments";
import { divisionStatus, phaseStatus, poolStatus, tournamentStatus } from "@/features/tournament/model/treeStatus";
import {
  divisionPagePath,
  divisionPath,
  parseTreeSelection,
  phasePath,
  poolPath,
  tournamentPagePath,
} from "@/features/tournament/model/treeSelection";
import { phaseGroupLabel } from "@/features/division/utils/phaseGroupLabel";
import ContextMenu, { useContextMenu, type ContextMenuItem } from "@/shared/components/ui/ContextMenu";
import { treeNodeKey } from "@/shared/lib/treeState";
import { usePermissions } from "@/shared/services/permissions/PermissionContext";

/**
 * The tournament tree: the whole navigation of the application in one column.
 *
 * Only the tournament the URL points at renders its structure. The others are
 * collapsed entries you click to go to, which keeps exactly one overview
 * request outstanding no matter how many tournaments are listed.
 *
 * Every destination a viewer cannot reach is left out rather than disabled.
 * A tree that shows doors that do not open teaches people to distrust it.
 */
export default function TournamentTree({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const tree = useTournamentTree();
  const { canEditTournament } = usePermissions();
  const { menu, openMenu, closeMenu } = useContextMenu();

  const [tournaments, setTournaments] = useState<Array<RecentTournament & { pinned: boolean }>>(getSidebarTournaments);
  const selection = useMemo(() => parseTreeSelection(location.pathname), [location.pathname]);

  /* The list is a localStorage snapshot, and a visit is what refreshes it, so
     it is re-read whenever the route changes rather than only on mount. */
  useEffect(() => {
    setTournaments(getSidebarTournaments());
  }, [location.pathname]);

  /* A deep link has to arrive with its branch already open, otherwise the
     selected node is invisible inside a collapsed tree. */
  const { expandNodes } = tree;
  useEffect(() => {
    if (!selection) return;
    const path = [treeNodeKey("tournament", selection.tournamentId)];
    if (selection.divisionId) path.push(treeNodeKey("division", selection.divisionId));
    if (selection.phaseId) path.push(treeNodeKey("phase", selection.phaseId));
    expandNodes(path);
  }, [selection, expandNodes]);

  const go = (path: string) => {
    navigate(path);
    onNavigate?.();
  };

  const refreshTournaments = () => setTournaments(getSidebarTournaments());

  /* ---- menus ---- */

  const tournamentMenu = (tournament: RecentTournament & { pinned: boolean }): ContextMenuItem[] => {
    const controls = canEditTournament(tournament.id);
    const isCurrent = tree.tournamentId === tournament.id;
    return [
      {
        key: "configuration",
        label: "Configuration",
        icon: faGear,
        hidden: !controls,
        onSelect: () => go(tournamentPagePath(tournament.id, "configuration")),
      },
      {
        key: "startgg",
        label: "Import from Start.gg",
        icon: faDownload,
        hidden: !controls || !isCurrent,
        onSelect: () => tree.openDialog({ kind: "startggImport" }),
      },
      {
        key: "bracket",
        label: "Generate bracket",
        icon: faSitemap,
        hidden: !controls || !isCurrent,
        onSelect: () => tree.openDialog({ kind: "generateBracket" }),
      },
      {
        key: "division",
        label: "New division",
        icon: faPlus,
        hidden: !controls || !isCurrent,
        onSelect: () => tree.openDialog({ kind: "createDivision" }),
      },
      {
        key: "pin",
        label: tournament.pinned ? "Unpin" : "Pin",
        icon: faThumbtack,
        onSelect: () => {
          if (tournament.pinned) unpinTournament(tournament.id);
          else pinTournament({ id: tournament.id, name: tournament.name, logo: tournament.logo });
          refreshTournaments();
        },
      },
      {
        key: "forget",
        label: "Remove from recents",
        icon: faXmark,
        hidden: tournament.pinned,
        onSelect: () => {
          removeRecentTournament(tournament.id);
          refreshTournaments();
        },
      },
    ];
  };

  const divisionMenu = (divisionId: number, name: string): ContextMenuItem[] => [
    {
      key: "phase",
      label: "New phase",
      icon: faPlus,
      onSelect: () => tree.openDialog({ kind: "createPhase", divisionId }),
    },
    {
      key: "bracket",
      label: "Generate bracket",
      icon: faSitemap,
      onSelect: () => tree.openDialog({ kind: "generateBracket", divisionId }),
    },
    {
      key: "rename",
      label: "Rename division",
      icon: faPenToSquare,
      onSelect: () =>
        tree.openDialog({
          kind: "rename",
          noun: "division",
          currentName: name,
          apply: (next) => tree.renameDivisionNode(divisionId, next),
        }),
    },
    {
      key: "delete",
      label: "Delete division",
      icon: faTrash,
      danger: true,
      onSelect: () => tree.removeDivision(divisionId),
      confirm: {
        message: `Delete division "${name}"? Its phases, pools and matches are deleted with it, and this cannot be undone.`,
        confirmText: "Delete division",
      },
    },
  ];

  const phaseMenu = (phaseId: number, name: string): ContextMenuItem[] => [
    {
      key: "pool",
      label: "New pool",
      icon: faPlus,
      onSelect: () => tree.createPool(phaseId),
    },
    {
      key: "rename",
      label: "Rename phase",
      icon: faPenToSquare,
      onSelect: () =>
        tree.openDialog({
          kind: "rename",
          noun: "phase",
          currentName: name,
          apply: (next) => tree.renamePhaseNode(phaseId, next),
        }),
    },
    {
      key: "delete",
      label: "Delete phase",
      icon: faTrash,
      danger: true,
      onSelect: () => tree.removePhase(phaseId),
      confirm: {
        message: `Delete phase "${name}"? Its pools and their matches are deleted with it, and this cannot be undone.`,
        confirmText: "Delete phase",
      },
    },
  ];

  const poolMenu = (
    divisionId: number,
    phaseId: number,
    poolId: number,
    name: string,
  ): ContextMenuItem[] => [
    {
      key: "advancement",
      label: "Advancement rules",
      icon: faSitemap,
      onSelect: () =>
        go(`${poolPath(tree.tournamentId ?? 0, divisionId, phaseId, poolId)}?edit=advancement`),
    },
    {
      key: "rename",
      label: "Rename pool",
      icon: faPenToSquare,
      onSelect: () =>
        tree.openDialog({
          kind: "rename",
          noun: "pool",
          currentName: name,
          apply: (next) => tree.renamePoolNode(poolId, next),
        }),
    },
    {
      key: "delete",
      label: "Delete pool",
      icon: faTrash,
      danger: true,
      onSelect: () => tree.removePool(poolId),
      confirm: {
        message: `Delete pool "${name}"? Its matches are deleted with it, and this cannot be undone.`,
        confirmText: "Delete pool",
      },
    },
  ];

  /* ---- render ---- */

  if (tournaments.length === 0) {
    return <p className="px-3 py-6 text-center text-xs italic text-ui-text-mute">No tournaments yet.</p>;
  }

  return (
    <>
      <div role="tree" aria-label="Tournaments" className="flex flex-col gap-0.5">
        {tournaments.map((tournament) => {
          const key = treeNodeKey("tournament", tournament.id);
          const isCurrent = tree.tournamentId === tournament.id;
          const expanded = isCurrent && tree.isExpanded(key);
          const controls = canEditTournament(tournament.id);
          /* Only the open tournament knows what is inside it. When it does, the
             row reports it like every other branch and the pin or clock moves
             next to the name, so a collapsed tree still shows what is waiting. */
          const rolledUpStatus = isCurrent ? tournamentStatus(tree.divisions) : undefined;
          const identityIcon = tournament.pinned ? faThumbtack : faClockRotateLeft;

          return (
            <div key={tournament.id} className="flex flex-col gap-0.5">
              <TreeNode
                label={tournament.name}
                depth={0}
                strong
                icon={rolledUpStatus ? undefined : identityIcon}
                status={rolledUpStatus}
                leading={
                  rolledUpStatus ? (
                    <FontAwesomeIcon icon={identityIcon} className="w-3 shrink-0 text-[10px] text-ui-text-mute" />
                  ) : undefined
                }
                expandable
                expanded={expanded}
                selected={Boolean(selection && selection.tournamentId === tournament.id && !selection.page && !selection.divisionId)}
                onActivate={(deep) => {
                  if (!isCurrent) {
                    go(tournamentPagePath(tournament.id, "overview"));
                    return;
                  }
                  tree.toggleNode(key, deep);
                }}
                onOpenMenu={(x, y) => openMenu(x, y, tournament.name, tournamentMenu(tournament))}
                extraAction={
                  controls
                    ? {
                        icon: faGear,
                        title: "Configuration",
                        onSelect: () => go(tournamentPagePath(tournament.id, "configuration")),
                      }
                    : undefined
                }
              />

              {expanded && (
                <>
                  {TOURNAMENT_TREE_PAGES.filter((page) => !page.requiresControl || controls).map((page) => (
                    <TreeNode
                      key={page.key}
                      label={page.label}
                      depth={1}
                      icon={page.icon}
                      selected={selection?.page === page.key}
                      onActivate={() => go(tournamentPagePath(tournament.id, page.key))}
                    />
                  ))}

                  {tree.divisions.map((division) => {
                    const divisionKey = treeNodeKey("division", division.id);
                    const divisionExpanded = tree.isExpanded(divisionKey);
                    return (
                      <div key={division.id} className="flex flex-col gap-0.5">
                        <TreeNode
                          label={division.name}
                          depth={1}
                          status={divisionStatus(division)}
                          expandable
                          expanded={divisionExpanded}
                          selected={
                            selection?.divisionId === division.id && !selection.phaseId && !selection.divisionPage
                          }
                          onActivate={(deep) => {
                            tree.toggleNode(divisionKey, deep);
                            go(divisionPath(tournament.id, division.id));
                          }}
                          onOpenMenu={
                            controls
                              ? (x, y) => openMenu(x, y, division.name, divisionMenu(division.id, division.name))
                              : undefined
                          }
                        />

                        {divisionExpanded && (
                          <>
                            {DIVISION_TREE_PAGES.filter((page) => !page.requiresControl || controls).map((page) => (
                              <TreeNode
                                key={page.key}
                                label={page.label}
                                depth={2}
                                icon={page.icon}
                                selected={
                                  selection?.divisionId === division.id && selection.divisionPage === page.key
                                }
                                onActivate={() => go(divisionPagePath(tournament.id, division.id, page.key))}
                              />
                            ))}

                            {division.phases.map((phase) => {
                              const phaseKey = treeNodeKey("phase", phase.id);
                              const phaseExpanded = tree.isExpanded(phaseKey);
                              return (
                                <div key={phase.id} className="flex flex-col gap-0.5">
                                  <TreeNode
                                    label={phase.name}
                                    depth={2}
                                    status={phaseStatus(phase)}
                                    expandable
                                    expanded={phaseExpanded}
                                    selected={selection?.phaseId === phase.id && !selection.poolId}
                                    onActivate={(deep) => {
                                      tree.toggleNode(phaseKey, deep);
                                      go(phasePath(tournament.id, division.id, phase.id));
                                    }}
                                    onOpenMenu={
                                      controls
                                        ? (x, y) => openMenu(x, y, phase.name, phaseMenu(phase.id, phase.name))
                                        : undefined
                                    }
                                  />

                                  {phaseExpanded &&
                                    (phase.phaseGroups ?? []).map((pool) => (
                                      <TreeNode
                                        key={pool.id}
                                        label={phaseGroupLabel(pool)}
                                        depth={3}
                                        status={poolStatus(pool)}
                                        count={pool.matchCount}
                                        selected={selection?.poolId === pool.id}
                                        onActivate={() =>
                                          go(poolPath(tournament.id, division.id, phase.id, pool.id))
                                        }
                                        onOpenMenu={
                                          controls
                                            ? (x, y) =>
                                                openMenu(x, y, phaseGroupLabel(pool), poolMenu(division.id, phase.id, pool.id, phaseGroupLabel(pool)))
                                            : undefined
                                        }
                                      />
                                    ))}
                                </div>
                              );
                            })}
                          </>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          );
        })}
      </div>

      <ContextMenu state={menu} onClose={closeMenu} />
    </>
  );
}
