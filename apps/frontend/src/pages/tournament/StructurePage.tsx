import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronUp, faXmark } from "@fortawesome/free-solid-svg-icons";

import { useTournamentPageContext } from "@/features/tournament/model/TournamentPageContext";
import { useTournamentTree } from "@/features/tournament/model/TournamentTreeContext";
import { useStructurePage } from "@/features/structure/model/useStructurePage";
import {
    addBracket,
    addNode,
    clearSlot,
    drawRoute,
    indexStructure,
    removeNode,
    renameNode,
    seatEntrants,
    setMatchSongs,
} from "@/features/structure/model/structureDraft";
import type { BracketRequest } from "@/features/structure/model/structureDraft";
import StructureCanvasView from "@/features/structure/ui/StructureCanvasView";
import StructureDock from "@/features/structure/ui/StructureDock";
import GeneratePanel from "@/features/structure/ui/GeneratePanel";
import AddSlot from "@/features/structure/ui/AddSlot";
import { spellReason } from "@/features/structure/model/planReasons";
import { FIRST_POOL_NAME, nextPoolName } from "@/features/division/model/poolVisibility";
import { btnPrimary, btnSecondary, focusRing } from "@/styles/buttonStyles";
import type { ArmedPlacement, CanvasCard, CanvasSelection, CanvasSlot } from "@/features/structure/model/structureCanvas";

/**
 * The whole shape of a division, on one page, written once.
 *
 * It replaces six dialogs that each knew one noun and none of which showed the
 * thing being changed: the dashed slots create, the dock under the canvas edits
 * whatever is selected, and a route is drawn between two cards that are both on
 * screen. The header counts what is wrong rather than what exists, because a
 * missing route is the one thing no dialog could ever have reported.
 *
 * Nothing here writes. Every gesture edits a draft, the canvas draws the
 * division as that draft would leave it, and Commit sends the whole change as
 * one plan in one transaction. What is on the canvas and not yet in the
 * database is drawn with the dashed outline, which is what the design system
 * already means by a thing that is not there yet — and while any of it is
 * outstanding the page says DRAFT, because a canvas that looks finished and is
 * not written is the one thing this page must never be.
 *
 * The page itself does not scroll; the canvas does. Everything else — the
 * header, the divisions, the dock — stays where it was put.
 *
 * Below `lg` this redirects to the tree, which keeps its single-row creations
 * on every size. The rule is that the tree creates rows and this page creates
 * plans.
 */
export default function StructurePage() {
    const { tournamentId, divisions, controls, hasStartggApiKey } = useTournamentPageContext();
    const tree = useTournamentTree();
    const page = useStructurePage(tournamentId, divisions);
    const [panel, setPanel] = useState<"dock" | "generate">("dock");
    const [armed, setArmed] = useState<ArmedPlacement | null>(null);
    const [importNotice, setImportNotice] = useState(false);

    const selectedCard = page.canvas.columns.flatMap((column) => column.cards).find((card) => card.key === selectionKey(page.selection));

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
    function dropRoute(target: { kind: "pool" | "match"; id: number; slots: CanvasCard["slots"] }): void {
        if (!armed) {
            return;
        }

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

    /** Every dashed slot on the canvas adds one thing to the thing it sits in. */
    function addFromSlot(slot: CanvasSlot, name: string): void {
        page.edit((draft) => addNode(draft, slot.noun === "Pool" ? "pool" : "match", slot.parentId, name));
    }

    /* A generated bracket is not a different kind of change. It joins the draft
       as dashed cards with its routes already between them, and leaves on the
       same Commit as everything somebody typed. */
    function addGeneratedBracket(request: BracketRequest): void {
        page.edit((draft) => addBracket(draft, page.divisionId, request));
    }

    /* A phase with no pool holds nothing and can be routed nowhere, so it never
       is what somebody meant to make. It arrives with the pool every phase has
       to have, which the canvas draws as the phase itself and which puts the
       slot that adds a match on screen straight away. */
    function addPhase(name: string): void {
        page.edit((draft) => {
            const withPhase = addNode(draft, "phase", page.divisionId, name);

            return addNode(withPhase, "pool", withPhase.added.at(-1)!.id, FIRST_POOL_NAME);
        });
    }

    function rename(name: string): void {
        if (!page.selection) {
            return;
        }
        page.edit((draft) => renameNode(draft, page.selection!, name));
    }

    function remove(): void {
        if (!page.selection) {
            return;
        }
        const selected = page.selection;
        page.edit((draft) => removeNode(draft, selected, indexStructure(page.division, page.matches, draft)));
        page.select(null);
    }

    /** A route is taken away where it is read, by emptying the slot it filled. */
    function deleteRoute(targetKind: "pool" | "match", targetId: number, slot: number): void {
        page.edit((draft) => clearSlot(draft, { targetKind, targetId, slot }));
    }

    /** What a slot offers to call the thing it makes, by what is already there. */
    function suggestedName(slot: CanvasSlot): string {
        if (slot.noun === "Pool") {
            return nextPoolName(page.division?.phases.find((phase) => phase.id === slot.parentId));
        }

        return `Match ${page.matches.filter((match) => match.phaseGroupId === slot.parentId).length + 1}`;
    }

    /** What a node in a reason is called, so the sentence names a thing. */
    function nameOfRef(ref: string): string | undefined {
        const [kind, raw] = ref.split(":");
        const id = Number(raw);
        if (kind === "phase") {
            return page.canvas.columns.find((column) => column.phaseId === id)?.name;
        }
        if (kind === "division") {
            return divisions.find((candidate) => candidate.id === id)?.name;
        }

        return page.canvas.columns.flatMap((column) => column.cards).find((card) => card.kind === kind && card.id === id)?.name;
    }

    if (!controls) {
        return <p className="p-4 text-sm text-ui-text-mute">Structure is where a tournament is built, and it is open to whoever can edit this one.</p>;
    }

    return (
        /* The canvas is the one thing on the page that scrolls, so the page
           itself has to end exactly where the window does. It takes the room
           that is left rather than naming a height: the tournament header above
           it wraps at some widths and a page notice appears at any of them, and
           a height measured from the viewport counts neither of them. */
        <div className="flex min-h-0 flex-1 flex-col gap-3.5 p-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-ui-text">
                    Structure
                    {/* Unwritten work is said out loud, in the colour the design
                        system keeps for a thing that is waiting on somebody. */}
                    {page.changes > 0 && (
                        <span className="rounded-full border border-state-pending/50 bg-state-pending/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-state-pending">
                            Draft
                        </span>
                    )}
                </h1>
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
                    {/* One canvas and no modes: what is not being worked on is
                        folded away, either one pool at a time or all at once. */}
                    <button type="button" onClick={() => page.foldAll(page.folded.size === 0)} className={`${btnSecondary} text-xs`}>
                        <FontAwesomeIcon icon={faChevronUp} className="mr-1.5 text-[10px]" />
                        {page.folded.size === 0 ? "Fold matches" : "Unfold matches"}
                    </button>
                    <button
                        type="button"
                        disabled={!page.division}
                        onClick={() => setPanel(panel === "generate" ? "dock" : "generate")}
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
                <div className="flex max-h-40 shrink-0 items-start gap-2 overflow-y-auto rounded border border-state-failed/40 bg-state-failed/10 px-3 py-2 text-sm text-state-failed">
                    <ul className="flex flex-1 flex-col gap-1">
                        {page.error.map((reason) => (
                            <li key={reason}>{spell(reason, nameOfRef, page.select)}</li>
                        ))}
                    </ul>
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

            <div className="hidden min-h-0 flex-1 flex-col gap-3.5 lg:flex">
                {/* The one thing on the page that scrolls. */}
                <div className="flex min-h-0 flex-1 rounded-xl border border-ui-border bg-ui-canvas p-3.5">
                    <StructureCanvasView
                        canvas={page.canvas}
                        selection={page.selection}
                        onSelect={page.select}
                        onAdd={(slot, name) => addFromSlot(slot, name)}
                        onAddPhase={(name) => addPhase(name)}
                        onToggleFold={page.toggleFold}
                        armed={armed}
                        onArm={setArmed}
                        onDropRoute={dropRoute}
                        suggestedName={suggestedName}
                        suggestedPhaseName={`Phase ${(page.division?.phases.length ?? 0) + 1}`}
                    />
                </div>

                {panel === "generate" && page.division ? (
                    <GeneratePanel division={page.division} onAdd={addGeneratedBracket} onClose={() => setPanel("dock")} />
                ) : (
                    <StructureDock
                        tournamentId={tournamentId}
                        division={page.division}
                        selection={page.selection}
                        card={selectedCard}
                        matches={page.matches}
                        roster={page.roster}
                        draft={page.draft}
                        onRename={rename}
                        onDelete={remove}
                        onDeleteRoute={deleteRoute}
                        onSeat={(matchId, entrantIds) => page.edit((draft) => seatEntrants(draft, matchId, entrantIds))}
                        onSetSongs={(matchId, songIds) => page.edit((draft) => setMatchSongs(draft, matchId, songIds))}
                        onClearSelection={() => page.select(null)}
                    />
                )}
            </div>
        </div>
    );
}

/**
 * A reason, with the nodes in it named and pointed at.
 *
 * The applier writes in local ids because that is the only thing a plan and a
 * database agree about. Nobody reads `phase:-2`, so each one is drawn as the
 * card it is, and clicking it selects that card — which is on the canvas in the
 * same red the sentence is in.
 */
function spell(reason: string, nameOfRef: (ref: string) => string | undefined, select: (selection: CanvasSelection) => void): React.ReactNode[] {
    return spellReason(reason).map((piece, index) => {
        if (!piece.ref) {
            return <span key={index}>{piece.text}</span>;
        }

        const [kind, raw] = piece.ref.split(":");

        return (
            <button
                key={index}
                type="button"
                disabled={kind === "division"}
                onClick={() => select({ kind: kind as "phase" | "pool" | "match", id: Number(raw) })}
                className={`${focusRing} rounded border border-state-failed/50 px-1 font-semibold`}
            >
                {nameOfRef(piece.ref) ?? piece.text}
            </button>
        );
    });
}

function selectionKey(selection: ReturnType<typeof useStructurePage>["selection"]): string | null {
    return selection ? `${selection.kind}:${selection.id}` : null;
}
