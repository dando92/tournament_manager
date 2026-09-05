import type { PlacementRunStepDto } from "@tournament-manager/contracts";

/**
 * The competitions somebody played, in the order they played them.
 *
 * One chip per step, filled where they won it and neutral where they did not,
 * so the last neutral chip is where their tournament ended. The label comes
 * from how far the competition sat from the end rather than from its name, and
 * the name itself is on the chip for anyone who wants it.
 */
export default function RunChips({ run }: { run: PlacementRunStepDto[] }) {
  if (run.length === 0) {
    return <span className="text-xs text-ui-text-mute">—</span>;
  }

  return (
    <span className="flex flex-wrap gap-1">
      {run.map((step, index) => (
        <span
          key={`${step.name}-${index}`}
          title={step.name}
          className={`inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded px-1 text-[10px] font-bold ${
            step.won ? "bg-state-done/12 text-state-done" : "bg-ui-text-mute/12 text-ui-text-mute"
          }`}
        >
          {step.label}
        </span>
      ))}
    </span>
  );
}
