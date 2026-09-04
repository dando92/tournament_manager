import type { StructurePlan } from "@tournament-manager/contracts";

/**
 * What a plan will make, before it exists.
 *
 * Everything the plan creates is drawn with the dashed outline the design system
 * already uses for something that is not there yet, and everything it links to
 * keeps the surface of a card that is: the difference between "this will be
 * built" and "this is already here and will be kept" is a shape, not a hue, so
 * it survives greyscale.
 *
 * The accent is deliberately not used here. It means selection everywhere in the
 * application, and lending it to a plan state would leave selection with no mark
 * of its own.
 */
export default function PlanPreviewColumn({ plan }: { plan: StructurePlan }) {
  const created = plan.nodes.filter((node) => node.action === "create");
  const linked = plan.nodes.filter((node) => node.action === "link" && node.name.trim());
  const matches = created.filter((node) => node.kind === "match");
  const phases = created.filter((node) => node.kind === "phase");
  const pools = created.filter((node) => node.kind === "phaseGroup");

  return (
    <section className="mt-3 rounded-xl border border-dashed border-ui-border-strong p-3" aria-label="What this plan will make">
      <header className="flex items-center gap-2">
        <span className="text-sm font-bold text-ui-text-soft">{phases[0]?.name ?? "Preview"}</span>
        <span className="rounded-full border border-dashed border-ui-border-strong px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ui-text-mute">
          Preview
        </span>
        <span className="ml-auto text-[12px] text-ui-text-mute">
          {pools.length} {pools.length === 1 ? "pool" : "pools"} · {matches.length} {matches.length === 1 ? "match" : "matches"} · {plan.routes.length}{" "}
          {plan.routes.length === 1 ? "route" : "routes"}
        </span>
      </header>

      {linked.length > 0 && (
        <p className="mt-1.5 text-[12px] text-ui-text-mute">
          Kept as it is: {linked.map((node) => node.name).join(", ")}
        </p>
      )}

      <ul className="mt-2 grid gap-1.5 md:grid-cols-2 lg:grid-cols-3">
        {matches.map((node) => (
          <li key={node.localId} className="rounded-lg border border-dashed border-ui-border-strong px-2.5 py-1.5">
            <span className="text-[12px] font-bold text-ui-text-soft">{node.name}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
