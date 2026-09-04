import { useCallback, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import type { StructurePlan } from "@tournament-manager/contracts";

import { useTournamentPageContext } from "@/features/tournament/model/TournamentPageContext";
import { useTournamentTree } from "@/features/tournament/model/TournamentTreeContext";
import { useStructurePage } from "@/features/structure/model/useStructurePage";
import { addNode, clearSlot, drawRoute, indexStructure, removeNode, renameNode } from "@/features/structure/model/structureDraft";
import StructureCanvasView from "@/features/structure/ui/StructureCanvasView";
import StructureInspector from "@/features/structure/ui/StructureInspector";
import GeneratePanel from "@/features/structure/ui/GeneratePanel";
import PlanPreviewColumn from "@/features/structure/ui/PlanPreviewColumn";
import AddSlot from "@/features/structure/ui/AddSlot";
import { nextPoolName } from "@/features/division/model/poolVisibility";
import { btnPrimary, btnSecondary, focusRing } from "@/styles/buttonStyles";
import type { ArmedPlacement, CanvasCard } from "@/features/structure/model/structureCanvas";

/**
 * The whole shape of a division, on one page, written once.
 *
 * It replaces six dialogs that each knew one noun and none of which showed the
 * thing being changed: the dashed slots create, the panel edits whatever is
 * selected, and a route is drawn between two cards that are both on screen. The
 * header counts what is wrong rather than what exists, because a missing route
 * is the one thing no dialog could ever have reported.
 *
 * Nothing here writes. Every gesture edits a draft, the canvas draws the
 * division as that draft would leave it, and Commit sends the whole change as
 * one plan in one transaction. What is on the canvas and not yet in the
 * database is drawn with the dashed outline, which is what the design system
 * already means by a thing that is not there yet.
 *
 * Below `lg` this redirects to the tree, which keeps its single-row creations
 * on every size. The rule is that the tree creates rows and this page creates
 * plans.
 */
export default function StructurePage() {
    const { tournamentId, divisions, controls, hasStartggApiKey } = useTournamentPageContext();
    const tree = useTournamentTree();
    const page = useStructurePage(tournamentId, divisions);
    const [preview, setPreview] = useState<StructurePlan | null>(null);
    const [panel, setPanel] = useState<"inspector" | "generate">("inspector");
    const [armed, setArmed] = useState<ArmedPlacement | null>(null);
    const [importNotice, setImportNotice] = useState(false);

    const selectedCard = page.canvas.columns.flatMap((column) => column.cards).find((card) => card.key === selectionKey(page.selection));

    const handlePreview = useCallback((plan: StructurePlan | null) => setPreview(plan), []);

    /* Aiming is a mode the page is in, so the key that leaves every other mode
       leaves this one. Without it the only way out is to click the same chip
       again, and by then the canvas has usually scrolled away from it. */
    useEffect(() => {
        if (!armed) {
            return;
        }
        const disarm = (event: KeyboardEvent) => event.key === "Escape" && setArmed(null);
        window.addEventListener("keydown", disarm);

        return () => window.removeEventListener("keydown", disarm);
    }, [armed]);

    /**
     * A route is drawn rather than typed: a placement chip is armed, every card
     * becomes a target, and the second click makes the rule. Click-click rather
     * than drag, because the canvas scrolls between the two ends.
     */
    function dropRoute(target: CanvasCard): void {
        if (!armed) return;

        const slot = target.kind === "match" ? (target.slots.find((entry) => !entry.from)?.slot ?? target.slots.length + 1) : armed.placement;
        page.edit((draft) =>
            drawRoute(draft, {
                sourceKind: armed.kind,
                sourceId: armed.id,
                placement: armed.placement,
                targetKind: target.kind,
                targetId: target.id,
                slot,
            }),
        );
        setArmed(null);
    }

    /** What a card in a column is: the pool. A match is added from its pool. */
    function addPool(phaseId: number, name: string): void {
        page.edit((draft) => addNode(draft, "pool", phaseId, name));
    }

    function addMatch(poolId: number, name: string): void {
        page.edit((draft) => addNode(draft, "match", poolId, name));
    }

    function addPhase(name: string): void {
        page.edit((draft) => addNode(draft, "phase", page.divisionId, name));
    }

    function rename(name: string): void {
        if (!page.selection) return;
        page.edit((draft) => renameNode(draft, page.selection!, name));
    }

    function remove(): void {
        if (!page.selection) return;
        const selected = page.selection;
        page.edit((draft) => removeNode(draft, selected, indexStructure(page.division, page.matches, draft)));
        page.select(null);
    }

    /** A route is taken away where it is read, by emptying the slot it filled. */
    function deleteRoute(targetKind: "pool" | "match", targetId: number, slot: number): void {
        page.edit((draft) => clearSlot(draft, { targetKind, targetId, slot }));
    }

    if (!controls) {
        return <p className="p-4 text-sm text-ui-text-mute">Structure is where a tournament is built, and it is open to whoever can edit this one.</p>;
    }

    return (
        <div className="flex h-full flex-col gap-3.5 p-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <h1 className="text-2xl font-bold tracking-tight text-ui-text">Structure</h1>
                <div className="flex flex-wrap items-center gap-2.5">
                    {page.changes > 0 && (
                        <span className="rounded-full border border-ui-border-strong px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ui-text-mute">
                            {page.changes} {page.changes === 1 ? "change" : "changes"} not saved
                        </span>
                    )}
                    {page.canvas.danglingPlacements > 0 && (
                        <span className="rounded-full border border-state-pending/40 bg-state-pending/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ui-text-mute">
                            {page.canvas.danglingPlacements} {page.canvas.danglingPlacements === 1 ? "placement goes" : "placements go"} nowhere
                        </span>
                    )}
                    {/* One canvas, two things to be doing on it: laying out the
                        shape, and saying where its finishers go. */}
                    <span className="inline-flex overflow-hidden rounded-lg border border-ui-border bg-ui-surface">
                        {([
                            { mode: "build", label: "Build" },
                            { mode: "routes", label: "Routes" },
                        ] as const).map((choice) => (
                            <button
                                key={choice.mode}
                                type="button"
                                onClick={() => page.setMode(choice.mode)}
                                className={`${focusRing} px-3 py-1.5 text-xs font-semibold ${
                                    page.mode === choice.mode ? "bg-ui-selected text-ui-text shadow-[inset_0_-3px_0_0_rgb(var(--ui-accent))]" : "text-ui-text-mute"
                                }`}
                            >
                                {choice.label}
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
                    {/* One structure, one write. Everything above edits a draft
                        and this is the only thing on the page that saves. */}
                    <button type="button" disabled={page.changes === 0} onClick={() => void page.discard()} className={`${btnSecondary} text-xs`}>
                        Discard
                    </button>
                    <button
                        type="button"
                        disabled={page.changes === 0 || page.applying}
                        onClick={() => void page.commit()}
                        className={`${btnPrimary} text-xs`}
                    >
                        {page.applying ? "Committing…" : "Commit"}
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
                        mode={page.mode}
                        selection={page.selection}
                        onSelect={page.select}
                        onAddCard={(phaseId, name) => addPool(phaseId, name)}
                        onAddPhase={(name) => addPhase(name)}
                        armed={armed}
                        onArm={setArmed}
                        onDropRoute={dropRoute}
                        suggestedCardName={(phaseId) => nextPoolName(page.division?.phases.find((phase) => phase.id === phaseId))}
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
                        onAddPool={addPool}
                        onAddMatch={addMatch}
                        onRename={rename}
                        onDelete={remove}
                        onDeleteRoute={deleteRoute}
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
