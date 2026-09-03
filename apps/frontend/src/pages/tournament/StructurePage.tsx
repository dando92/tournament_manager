import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import type { PlanNode, StructurePlan } from "@tournament-manager/contracts";

import { useTournamentPageContext } from "@/features/tournament/model/TournamentPageContext";
import { useTournamentTree } from "@/features/tournament/model/TournamentTreeContext";
import { useStructurePage } from "@/features/structure/model/useStructurePage";
import { routePlan, singleNodePlan } from "@/features/structure/model/generatorPlan";
import StructureCanvasView from "@/features/structure/ui/StructureCanvasView";
import StructureInspector from "@/features/structure/ui/StructureInspector";
import GeneratePanel from "@/features/structure/ui/GeneratePanel";
import PlanPreviewColumn from "@/features/structure/ui/PlanPreviewColumn";
import AddSlot from "@/features/structure/ui/AddSlot";
import { deleteMatch, renameMatch } from "@/features/match/api/match.api";
import { nextPoolName } from "@/features/division/model/poolVisibility";
import { poolPath } from "@/features/tournament/model/treeSelection";
import { btnSecondary, focusRing } from "@/styles/buttonStyles";
import type { CanvasCard } from "@/features/structure/model/structureCanvas";

/**
 * The whole shape of a division, on one page.
 *
 * It replaces six dialogs that each knew one noun and none of which showed the
 * thing being changed: the dashed slots create, the panel edits whatever is
 * selected, and a route is drawn between two cards that are both on screen. The
 * header counts what is wrong rather than what exists, because a missing route
 * is the one thing no dialog could ever have reported.
 *
 * Below `lg` this redirects to the tree, which keeps its single-row creations
 * on every size. The rule is that the tree creates rows and this page creates
 * plans.
 */
export default function StructurePage() {
    const { tournamentId, divisions, controls, hasStartggApiKey } = useTournamentPageContext();
    const tree = useTournamentTree();
    const navigate = useNavigate();
    const page = useStructurePage(tournamentId, divisions);
    const [preview, setPreview] = useState<StructurePlan | null>(null);
    const [panel, setPanel] = useState<"inspector" | "generate">("inspector");
    const [armed, setArmed] = useState<{ poolId: number; placement: number } | null>(null);
    const [importNotice, setImportNotice] = useState(false);

    const selectedCard = page.canvas.columns.flatMap((column) => column.cards).find((card) => card.key === selectionKey(page.selection));

    const handlePreview = useCallback((plan: StructurePlan | null) => setPreview(plan), []);

    /**
     * A route is drawn rather than typed: a placement chip is armed, every card
     * becomes a target, and the second click makes the rule. Click-click rather
     * than drag, because the canvas scrolls between the two ends.
     */
    async function dropRoute(target: CanvasCard): Promise<void> {
        if (!armed || !page.division) return;

        const source: PlanNode = { localId: "source", kind: "phaseGroup", action: "link", localRowId: armed.poolId, name: "" };
        const destination: PlanNode = {
            localId: "target",
            kind: target.kind === "pool" ? "phaseGroup" : "match",
            action: "link",
            localRowId: target.id,
            name: "",
        };
        const nextSlot = target.kind === "match" ? (target.slots.find((slot) => !slot.from)?.slot ?? target.slots.length + 1) : armed.placement;

        await page.apply(
            routePlan(tournamentId, [source, destination], {
                sourceLocalId: "source",
                sourcePlacement: armed.placement,
                targetLocalId: "target",
                targetSlot: nextSlot,
            }),
        );
        setArmed(null);
    }

    async function addCard(phaseId: number, name: string): Promise<void> {
        if (page.density === "matches") {
            const pool = page.division?.phases.find((phase) => phase.id === phaseId)?.phaseGroups?.[0];
            if (!pool) return;
            await page.apply(
                singleNodePlan(
                    tournamentId,
                    { localId: "match", kind: "match", parentLocalId: "pool", action: "create", name },
                    [{ localId: "pool", kind: "phaseGroup", action: "link", localRowId: pool.id, name: "" }],
                ),
            );
            return;
        }

        await tree.createPool(phaseId, name);
        await page.refresh();
    }

    async function addPhase(name: string): Promise<void> {
        if (!page.division) return;
        await tree.addPhase(page.division.id, name);
        await page.refresh();
    }

    async function rename(name: string): Promise<void> {
        if (!page.selection) return;
        if (page.selection.kind === "pool") {
            await tree.renamePoolNode(page.selection.id, name);
        } else {
            await renameMatch(page.selection.id, name);
        }
        await page.refresh();
    }

    async function remove(): Promise<void> {
        if (!page.selection) return;
        if (page.selection.kind === "pool") {
            await tree.removePool(page.selection.id);
        } else {
            await deleteMatch(page.selection.id);
        }
        page.select(null);
        await page.refresh();
    }

    /**
     * The rules of a pool are also a sentence, and that editor is the path from a
     * phone and from a keyboard. It is not a leftover: an alternative to pointing
     * at two cards has to exist, so the panel opens the same one.
     */
    function openRouteEditor(): void {
        const phase = page.division?.phases.find((candidate) => (candidate.phaseGroups ?? []).some((pool) => pool.id === page.selection?.id));
        if (!page.division || !phase || page.selection?.kind !== "pool") return;
        navigate(`${poolPath(tournamentId, page.division.id, phase.id, page.selection.id)}?edit=advancement`);
    }

    if (!controls) {
        return <p className="p-4 text-sm text-ui-text-mute">Structure is where a tournament is built, and it is open to whoever can edit this one.</p>;
    }

    return (
        <div className="flex h-full flex-col gap-3.5 p-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <h1 className="text-2xl font-bold tracking-tight text-ui-text">Structure</h1>
                <div className="flex flex-wrap items-center gap-2.5">
                    {page.canvas.danglingPlacements > 0 && (
                        <span className="rounded-full border border-state-pending/40 bg-state-pending/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ui-text-mute">
                            {page.canvas.danglingPlacements} {page.canvas.danglingPlacements === 1 ? "placement goes" : "placements go"} nowhere
                        </span>
                    )}
                    <span className="inline-flex overflow-hidden rounded-lg border border-ui-border bg-ui-surface">
                        {(["pools", "matches"] as const).map((density) => (
                            <button
                                key={density}
                                type="button"
                                onClick={() => page.setDensity(density)}
                                className={`${focusRing} px-3 py-1.5 text-xs font-semibold capitalize ${
                                    page.density === density ? "bg-ui-selected text-ui-text shadow-[inset_0_-3px_0_0_rgb(var(--ui-accent))]" : "text-ui-text-mute"
                                }`}
                            >
                                {density}
                            </button>
                        ))}
                    </span>
                    <button
                        type="button"
                        disabled={!page.division}
                        onClick={() => setPanel(panel === "generate" ? "inspector" : "generate")}
                        className={`${btnSecondary} text-xs`}
                    >
                        Generate…
                    </button>
                    <button
                        type="button"
                        onClick={() => (hasStartggApiKey ? tree.openDialog({ kind: "startggImport" }) : setImportNotice(true))}
                        className={`${btnSecondary} text-xs`}
                    >
                        Import…
                    </button>
                </div>
            </div>

            {/* A failure is stated where the action was taken, and does not expire. */}
            {page.error && (
                <div className="flex items-start gap-2 rounded border border-state-failed/40 bg-state-failed/10 px-3 py-2 text-sm text-state-failed">
                    <span className="flex-1">{page.error}</span>
                    <button type="button" aria-label="Dismiss" onClick={page.dismissError} className={focusRing}>
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>
            )}

            {importNotice && (
                <div className="flex items-start gap-2 rounded border border-ui-border bg-ui-raised px-3 py-2 text-sm text-ui-text-soft">
                    <span className="flex-1">
                        Importing needs a start.gg API key for this tournament. It is set in the tournament configuration, and the button works once it is
                        there.
                    </span>
                    <button type="button" aria-label="Dismiss" onClick={() => setImportNotice(false)} className={focusRing}>
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>
            )}

            <div className="flex flex-wrap items-end gap-1.5 border-b border-ui-border">
                {divisions.map((candidate) => (
                    <button
                        key={candidate.id}
                        type="button"
                        onClick={() => page.selectDivision(candidate.id)}
                        className={`${focusRing} flex items-baseline gap-2 rounded-t-lg border px-3 py-1.5 text-[13px] ${
                            candidate.id === page.divisionId
                                ? "border-ui-border-strong bg-ui-selected font-bold text-ui-text shadow-[inset_0_-3px_0_0_rgb(var(--ui-accent))]"
                                : "border-transparent text-ui-text-mute"
                        }`}
                    >
                        {candidate.name}
                        <span className="text-[11px] text-ui-text-mute">
                            {candidate.phases.length} {candidate.phases.length === 1 ? "phase" : "phases"}
                        </span>
                    </button>
                ))}
                <AddSlot
                    noun="Division"
                    suggestedName={`Division ${divisions.length + 1}`}
                    onCreate={async (name) => {
                        await tree.addDivision(name);
                        await page.refresh();
                    }}
                    className="mb-1 ml-1.5 h-8 w-32"
                />
            </div>

            {/* The builder is a desktop surface. A phone keeps the tree, which
                creates a division, a phase or a pool at every size — the rule is
                that the tree creates rows and this page creates plans. */}
            <p className="rounded border border-ui-border bg-ui-raised px-3 py-2 text-sm text-ui-text-soft lg:hidden">
                The structure builder needs a wide screen. On this one, the tree beside the page adds and renames a division, a phase or a pool, and a match is
                created from its pool.
            </p>

            <div className="hidden min-h-0 flex-1 gap-5 lg:flex">
                <div className="min-w-0 flex-1">
                    <StructureCanvasView
                        canvas={page.canvas}
                        selection={page.selection}
                        onSelect={page.select}
                        onAddCard={addCard}
                        onAddPhase={addPhase}
                        armed={armed}
                        onArm={setArmed}
                        onDropRoute={dropRoute}
                        suggestedCardName={(phaseId) =>
                            page.density === "matches"
                                ? `Match ${(page.division?.phases.find((phase) => phase.id === phaseId)?.matchCount ?? 0) + 1}`
                                : nextPoolName(page.division?.phases.find((phase) => phase.id === phaseId))
                        }
                        suggestedPhaseName={`Phase ${(page.division?.phases.length ?? 0) + 1}`}
                    />
                    {preview && <PlanPreviewColumn plan={preview} />}
                </div>

                {panel === "generate" && page.division ? (
                    <GeneratePanel
                        tournamentId={tournamentId}
                        division={page.division}
                        applying={page.applying}
                        onPreview={handlePreview}
                        onApply={page.apply}
                        onClose={() => setPanel("inspector")}
                    />
                ) : (
                    <StructureInspector
                        division={page.division}
                        selection={page.selection}
                        card={selectedCard}
                        matches={page.matches}
                        onRename={rename}
                        onDelete={remove}
                        onEditRoutes={openRouteEditor}
                        onClearSelection={() => page.select(null)}
                    />
                )}
            </div>
        </div>
    );
}

function selectionKey(selection: ReturnType<typeof useStructurePage>["selection"]): string | null {
    return selection ? `${selection.kind}:${selection.id}` : null;
}
