import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faChevronRight } from "@fortawesome/free-solid-svg-icons";

import StatusIcon from "@/shared/components/ui/StatusIcon";
import AddSlot from "@/features/structure/ui/AddSlot";
import { focusRing } from "@/styles/buttonStyles";
import {
    COLUMN_WIDTH,
    headerHeight,
    type ArmedPlacement,
    type CanvasCard,
    type CanvasColumn,
    type CanvasSelection,
    type CanvasSlot,
    type PlacementChip,
    type StructureCanvas,
} from "@/features/structure/model/structureCanvas";

type Props = {
    canvas: StructureCanvas;
    selection: CanvasSelection;
    onSelect: (selection: CanvasSelection) => void;
    /** A dashed slot was filled in: it says what it adds and to what. */
    onAdd: (slot: CanvasSlot, name: string, keepGoing: boolean) => void;
    onAddPhase: (name: string, keepGoing: boolean) => void;
    onToggleFold: (poolId: number) => void;
    /** The placement chip that is armed, waiting for a target to be clicked. */
    armed: ArmedPlacement | null;
    onArm: (armed: ArmedPlacement | null) => void;
    onDropRoute: (target: { kind: "pool" | "match"; id: number; slots: CanvasCard["slots"] }) => void;
    suggestedName: (slot: CanvasSlot) => string;
    suggestedPhaseName: string;
};

/**
 * The canvas: one column per phase, the routes in the gaps between them.
 *
 * The whole thing is absolutely positioned from arithmetic done in
 * `structureCanvas`, so where a card sits and where an edge lands are one
 * calculation rather than a layout that the edges then have to guess at.
 *
 * There is one canvas and no modes: a pool holds its matches and the slot that
 * adds another, a phase with one pool is drawn as that pool, and every route is
 * drawn all the time. What is not being worked on is folded rather than
 * switched away from.
 *
 * Routes are drawn under the cards. They run through the gaps, so nothing is
 * hidden, and a card that overlaps one covers a curve rather than a name.
 */
export default function StructureCanvasView({
    canvas,
    selection,
    onSelect,
    onAdd,
    onAddPhase,
    onToggleFold,
    armed,
    onArm,
    onDropRoute,
    suggestedName,
    suggestedPhaseName,
}: Props) {
    const isArmedSource = (kind: "pool" | "match", id: number) => armed?.kind === kind && armed.id === id;
    /* Everywhere a route can land says so with a ring. The accent is selection
       and aiming is a kind of selection, so it is the right borrowing; the dash
       is not, because a dash means a thing that is not there yet. */
    const isTarget = (kind: "pool" | "match", id: number) => Boolean(armed) && !isArmedSource(kind, id);

    function chipOf(kind: "pool" | "match", id: number, name: string, chip: PlacementChip) {
        const armedHere = isArmedSource(kind, id) && armed?.placement === chip.placement;

        return (
            <span
                key={chip.placement}
                role="button"
                tabIndex={0}
                aria-label={chip.routed ? `${chip.label} of ${name}` : `${chip.label} of ${name}, routed nowhere`}
                title={chip.routed ? `${chip.label} of ${name}` : `${chip.label} of ${name} goes nowhere yet`}
                onClick={(event) => {
                    event.stopPropagation();
                    onArm(armedHere ? null : { kind, id, placement: chip.placement });
                }}
                onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") {
                        return;
                    }
                    event.preventDefault();
                    event.stopPropagation();
                    onArm({ kind, id, placement: chip.placement });
                }}
                className={`rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${
                    armedHere
                        ? "border-ui-accent bg-ui-accent/10 text-ui-accent"
                        : chip.routed
                          ? "border-ui-border bg-ui-raised text-ui-text-mute"
                          : "border-dashed border-ui-border-strong text-ui-text-mute"
                }`}
            >
                {chip.label}
            </span>
        );
    }

    return (
        <div className="relative min-h-0 min-w-0 flex-1 overflow-auto">
            <div className="relative" style={{ width: canvas.width, height: canvas.height + 8 }}>
                <svg width={canvas.width} height={canvas.height} className="absolute left-0 top-0" aria-hidden="true">
                    <defs>
                        <marker id="structure-arrow" viewBox="0 0 8 8" refX="6.6" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                            <path d="M1 1 L6.6 4 L1 7 Z" className="fill-ui-border-strong" />
                        </marker>
                    </defs>
                    {canvas.edges.map((edge) => (
                        <path
                            key={edge.key}
                            d={edge.path}
                            fill="none"
                            strokeWidth={edge.highlighted ? 1.8 : 1.3}
                            markerEnd="url(#structure-arrow)"
                            /* Every route stays drawn. One that has nothing to do
                               with what is selected steps back rather than leaving,
                               so the shape of the division is never a guess. */
                            className={`${edge.highlighted ? "stroke-ui-accent" : "stroke-ui-border-strong"} ${
                                selection && !edge.highlighted ? "opacity-30" : ""
                            }`}
                        />
                    ))}
                </svg>

                {canvas.columns.map((column) => (
                    <div key={column.phaseId} className="absolute top-0" style={{ left: column.left, width: COLUMN_WIDTH }}>
                        <PhaseHeader
                            column={column}
                            selection={selection}
                            armed={armed}
                            isTarget={column.poolId !== null && isTarget("pool", column.poolId)}
                            onSelect={onSelect}
                            onToggleFold={onToggleFold}
                            onDropRoute={onDropRoute}
                            chipOf={chipOf}
                        />

                        {column.cards.map((card) => (
                            <button
                                key={card.key}
                                type="button"
                                onClick={() => (armed ? onDropRoute(card) : onSelect({ kind: card.kind, id: card.id }))}
                                className={`absolute flex flex-col rounded-lg border px-2.5 py-2 text-left shadow-card transition-colors ${
                                    (selection?.kind === card.kind && selection.id === card.id) || isArmedSource(card.kind, card.id)
                                        ? "border-ui-border-strong bg-ui-selected shadow-[inset_3px_0_0_0_rgb(var(--ui-accent))]"
                                        : "border-ui-border bg-ui-surface hover:bg-ui-raised"
                                } ${card.pending ? "border-dashed border-ui-border-strong bg-transparent shadow-none" : ""} ${
                                    isTarget(card.kind, card.id) ? "ring-2 ring-ui-accent" : ""
                                } ${card.faulted ? "ring-2 ring-state-failed" : ""}`}
                                style={{ top: card.top, left: card.left, width: card.width, height: card.height }}
                            >
                                <span className="flex items-center gap-2">
                                    {card.kind === "pool" ? (
                                        <FoldToggle folded={Boolean(card.folded)} name={card.name} onToggle={() => onToggleFold(card.id)} />
                                    ) : (
                                        <StatusIcon status={card.status} />
                                    )}
                                    <span className="truncate text-sm font-bold text-ui-text">{card.name}</span>
                                    {card.meta[0] && <span className="ml-auto shrink-0 text-[11px] text-ui-text-mute">{card.meta[0]}</span>}
                                </span>
                                {card.meta[1] && <span className="mt-0.5 truncate text-[11px] text-ui-text-mute">{card.meta[1]}</span>}

                                {card.slots.length > 0 && (
                                    <span className="mt-0.5 flex flex-col gap-px">
                                        {card.slots.map((slot) => (
                                            <span key={slot.slot} className="flex items-center gap-1.5 text-[11px] text-ui-text-mute">
                                                <span className="rounded border border-ui-border bg-ui-raised px-1 font-semibold text-ui-text">{slot.slot}</span>
                                                <span className="truncate italic">{slot.from ?? "nobody yet"}</span>
                                            </span>
                                        ))}
                                    </span>
                                )}

                                {card.chips.length > 0 && (
                                    <span className="mt-1.5 flex flex-wrap gap-1">{card.chips.map((chip) => chipOf(card.kind, card.id, card.name, chip))}</span>
                                )}
                            </button>
                        ))}

                        {column.slots.map((slot) => (
                            <AddSlot
                                key={slot.key}
                                noun={slot.noun}
                                suggestedName={suggestedName(slot)}
                                onCreate={(name, keepGoing) => onAdd(slot, name, keepGoing)}
                                className="absolute"
                                style={{ top: slot.top, left: slot.left, width: slot.width, height: slot.height }}
                            />
                        ))}
                    </div>
                ))}

                {/* The slot that adds a phase takes the place the phase will:
                    a whole column, starting where its header will start. */}
                <AddSlot
                    noun="Phase"
                    suggestedName={suggestedPhaseName}
                    onCreate={onAddPhase}
                    className="absolute top-0"
                    style={{ left: canvas.addColumnLeft, width: COLUMN_WIDTH, height: 54 }}
                />
            </div>
        </div>
    );
}

/**
 * The phase, and — when it draws no pool of its own — the pool it holds.
 *
 * Both identities are on the one card because that is what the tree has always
 * shown: the name is the phase's, so clicking selects the phase and renaming
 * renames it, while the placements and the routes belong to the pool, because
 * a phase has never been a thing a route can reach.
 */
function PhaseHeader({
    column,
    selection,
    armed,
    isTarget,
    onSelect,
    onToggleFold,
    onDropRoute,
    chipOf,
}: {
    column: CanvasColumn;
    selection: CanvasSelection;
    armed: ArmedPlacement | null;
    isTarget: boolean;
    onSelect: (selection: CanvasSelection) => void;
    onToggleFold: (poolId: number) => void;
    onDropRoute: (target: { kind: "pool" | "match"; id: number; slots: CanvasCard["slots"] }) => void;
    chipOf: (kind: "pool" | "match", id: number, name: string, chip: PlacementChip) => JSX.Element;
}) {
    const selected = selection?.kind === "phase" && selection.id === column.phaseId;
    const drop = () => column.poolId !== null && onDropRoute({ kind: "pool", id: column.poolId, slots: [] });

    return (
        <button
            type="button"
            onClick={() => (armed ? drop() : onSelect({ kind: "phase", id: column.phaseId }))}
            className={`flex w-full flex-col justify-center gap-0.5 rounded-xl border px-2.5 py-2 text-left ${focusRing} ${
                selected ? "border-ui-border-strong bg-ui-selected shadow-[inset_3px_0_0_0_rgb(var(--ui-accent))]" : "border-ui-border bg-ui-raised"
            } ${isTarget ? "ring-2 ring-ui-accent" : ""} ${column.faulted ? "ring-2 ring-state-failed" : ""}`}
            style={{ height: headerHeight(column.chips) }}
        >
            <span className="flex items-center gap-2">
                {column.poolId !== null ? (
                    <FoldToggle folded={false} name={column.name} onToggle={() => onToggleFold(column.poolId!)} />
                ) : (
                    <StatusIcon status={column.status} />
                )}
                <span className="truncate text-[15px] font-bold text-ui-text">{column.name}</span>
            </span>
            <span className="text-[11px] text-ui-text-mute">{column.meta}</span>
            {column.chips.length > 0 && (
                <span className="mt-1 flex flex-wrap gap-1">{column.chips.map((chip) => chipOf("pool", column.poolId!, column.name, chip))}</span>
            )}
        </button>
    );
}

/** The chevron that shuts a pool's matches away, and says which way it is. */
function FoldToggle({ folded, name, onToggle }: { folded: boolean; name: string; onToggle: () => void }) {
    return (
        <span
            role="button"
            tabIndex={0}
            aria-label={folded ? `Show the matches of ${name}` : `Hide the matches of ${name}`}
            onClick={(event) => {
                event.stopPropagation();
                onToggle();
            }}
            onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") {
                    return;
                }
                event.preventDefault();
                event.stopPropagation();
                onToggle();
            }}
            className="shrink-0 text-ui-text-mute hover:text-ui-text"
        >
            <FontAwesomeIcon icon={folded ? faChevronRight : faChevronDown} className="text-[10px]" />
        </span>
    );
}
