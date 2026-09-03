import type { PlanNode, PlanNodeKind, StructurePlan } from "@/features/tournament/model/types";
import type { Status } from "@/shared/components/ui/status";

/**
 * Reading a plan.
 *
 * The plan states facts — what applying does to a node, and whether a link was
 * a stored mapping or a name that looked the same. The sentence a person reads
 * is composed here, because a rendered label in a shared contract is
 * presentation nobody downstream can reword.
 */

export function planNodesOfKind(plan: StructurePlan, kind: PlanNodeKind): PlanNode[] {
  return plan.nodes.filter((node) => node.kind === kind);
}

export type PlanKindCounts = {
  create: number;
  link: number;
  skip: number;
  total: number;
};

export function planCounts(plan: StructurePlan, kind: PlanNodeKind): PlanKindCounts {
  const nodes = planNodesOfKind(plan, kind);

  return {
    create: nodes.filter((node) => node.action === "create").length,
    link: nodes.filter((node) => node.action === "link").length,
    skip: nodes.filter((node) => node.action === "skip").length,
    total: nodes.length,
  };
}

/** What the plan will do to this node, in the words its kind deserves. */
export function planActionLabel(node: PlanNode): string {
  if (node.action === "skip") {
    return "Left out";
  }

  if (node.action === "link") {
    if (node.linkEvidence === "name") {
      return node.kind === "participant" ? "Match existing participant" : node.kind === "entrant" ? "Match existing entrant" : "Match existing";
    }

    return "Mapped";
  }

  switch (node.kind) {
    case "division":
      return "Create division";
    case "phase":
      return "Create phase";
    case "phaseGroup":
      return "Create pool";
    case "match":
      return "Create match";
    case "entrant":
      return node.entrantType === "team" ? "Create team entrant" : "Create entrant";
    case "participant":
      /* A participant with no player behind it brings one with it, which is a
         bigger write than attaching a participant to somebody already known. */
      return node.localPlayerId ? "Create participant" : "Create player + participant";
  }
}

/** The same glyph the rest of the application uses, so a plan reads like a list. */
export function planActionStatus(node: PlanNode): Status {
  if (node.needsAttention) return "pending";
  if (node.action === "skip") return "idle";

  return node.action === "link" ? "done" : "running";
}
