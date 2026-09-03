import StatusIcon from "@/shared/components/ui/StatusIcon";
import AddSlot from "@/features/structure/ui/AddSlot";
import {
  ADD_COLUMN_WIDTH,
  COLUMN_WIDTH,
  HEADER_HEIGHT,
  SLOT_HEIGHT,
  type CanvasCard,
  type CanvasSelection,
  type StructureCanvas,
} from "@/features/structure/model/structureCanvas";

type Props = {
  canvas: StructureCanvas;
  selection: CanvasSelection;
  onSelect: (selection: CanvasSelection) => void;
  onAddCard: (phaseId: number, name: string, keepGoing: boolean) => Promise<void>;
  onAddPhase: (name: string, keepGoing: boolean) => Promise<void>;
  /** The placement chip that is armed, waiting for a target to be clicked. */
  armed: { poolId: number; placement: number } | null;
  onArm: (armed: { poolId: number; placement: number } | null) => void;
  onDropRoute: (target: CanvasCard) => Promise<void>;
  suggestedCardName: (phaseId: number) => string;
  suggestedPhaseName: string;
};

/**
 * The canvas: one column per phase, the routes in the gaps between them.
 *
 * The whole thing is absolutely positioned from arithmetic done in
 * `structureCanvas`, so where a card sits and where an edge lands are one
 * calculation rather than a layout that the edges then have to guess at.
 *
 * Routes are drawn under the cards. They run through the gaps, so nothing is
 * hidden, and a card that overlaps one covers a curve rather than a name.
 */
export default function StructureCanvasView({
  canvas,
  selection,
  onSelect,
  onAddCard,
  onAddPhase,
  armed,
  onArm,
  onDropRoute,
  suggestedCardName,
  suggestedPhaseName,
}: Props) {
  const isSelected = (card: CanvasCard) => selection?.kind === card.kind && selection.id === card.id;

  return (
    <div className="relative overflow-x-auto pb-4">
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
              className={edge.highlighted ? "stroke-ui-accent" : "stroke-ui-border-strong"}
            />
          ))}
        </svg>

        {canvas.columns.map((column) => (
          <div key={column.phaseId} className="absolute top-0" style={{ left: column.left, width: COLUMN_WIDTH }}>
            <div
              className="flex flex-col justify-center gap-0.5 rounded-xl border border-ui-border bg-ui-raised px-2.5 py-2"
              style={{ height: HEADER_HEIGHT }}
            >
              <div className="flex items-center gap-2">
                <StatusIcon status={column.status} />
                <span className="truncate text-[15px] font-bold text-ui-text">{column.name}</span>
              </div>
              <div className="text-[11px] text-ui-text-mute">{column.meta}</div>
            </div>

            {column.cards.map((card) => (
              <button
                key={card.key}
                type="button"
                onClick={() => (armed ? void onDropRoute(card) : onSelect({ kind: card.kind, id: card.id }))}
                className={`absolute left-0 flex w-full flex-col rounded-lg border px-2.5 py-2 text-left shadow-card transition-colors ${
                  isSelected(card)
                    ? "border-ui-border-strong bg-ui-selected shadow-[inset_3px_0_0_0_rgb(var(--ui-accent))]"
                    : armed
                      ? "border-dashed border-ui-accent bg-ui-surface"
                      : "border-ui-border bg-ui-surface hover:bg-ui-raised"
                }`}
                style={{ top: card.top, height: card.height }}
              >
                <span className="flex items-center gap-2">
                  <StatusIcon status={card.status} />
                  <span className="truncate text-sm font-bold text-ui-text">{card.name}</span>
                  {card.meta[0] && <span className="ml-auto shrink-0 text-[11px] text-ui-text-mute">{card.meta[0]}</span>}
                </span>
                {card.meta[1] && <span className="mt-0.5 truncate text-[11px] text-ui-text-mute">{card.meta[1]}</span>}

                {card.slots.length > 0 && (
                  <span className="mt-0.5 flex flex-col gap-px">
                    {card.slots.map((slot) => (
                      <span key={slot.slot} className="flex items-center gap-1.5 text-[11px] text-ui-text-mute">
                        <span className="rounded border border-ui-border bg-ui-raised px-1 font-semibold text-ui-text">{slot.slot}</span>
                        <span className={slot.from ? "truncate italic" : "truncate italic text-ui-text-mute"}>{slot.from ?? "nobody yet"}</span>
                      </span>
                    ))}
                  </span>
                )}

                {card.chips.length > 0 && (
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    {card.chips.map((chip) => (
                      <span
                        key={chip.placement}
                        role="button"
                        tabIndex={0}
                        aria-label={`${chip.label} of ${card.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onArm(
                            armed?.poolId === card.id && armed.placement === chip.placement
                              ? null
                              : { poolId: card.id, placement: chip.placement },
                          );
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter" && event.key !== " ") return;
                          event.preventDefault();
                          event.stopPropagation();
                          onArm({ poolId: card.id, placement: chip.placement });
                        }}
                        className={`rounded-full border px-1.5 text-[10px] font-bold ${
                          armed?.poolId === card.id && armed.placement === chip.placement
                            ? "border-ui-accent bg-ui-accent/10 text-ui-accent"
                            : chip.routed
                              ? "border-ui-border bg-ui-raised text-ui-text-mute"
                              : "border-dashed border-ui-border-strong text-ui-text-mute"
                        }`}
                      >
                        {chip.label}
                        {!chip.routed && " → nowhere"}
                      </span>
                    ))}
                  </span>
                )}
              </button>
            ))}

            <AddSlot
              noun={column.slotLabel}
              suggestedName={suggestedCardName(column.phaseId)}
              onCreate={(name, keepGoing) => onAddCard(column.phaseId, name, keepGoing)}
              className="absolute left-0"
              style={{ top: column.slotTop, height: SLOT_HEIGHT, width: COLUMN_WIDTH }}
            />
          </div>
        ))}

        <AddSlot
          noun="Phase"
          suggestedName={suggestedPhaseName}
          onCreate={onAddPhase}
          className="absolute top-0"
          style={{ left: canvas.addColumnLeft, width: ADD_COLUMN_WIDTH, height: HEADER_HEIGHT }}
        />
      </div>
    </div>
  );
}
