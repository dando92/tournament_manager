import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash } from "@fortawesome/free-solid-svg-icons";

import StatusIcon from "@/shared/components/ui/StatusIcon";
import AddSlot from "@/features/structure/ui/AddSlot";
import { btnDanger, btnTrash, focusRing } from "@/styles/buttonStyles";
import { ordinal, type CanvasCard, type CanvasSelection } from "@/features/structure/model/structureCanvas";
import { collectRoutes, routesOf } from "@/features/structure/model/structureRoutes";
import type { AdvancementRuleDto } from "@tournament-manager/contracts";
import type { Match } from "@/features/match/model/types";
import type { TournamentDivisionOption, TournamentDivisionOptionPhase } from "@/features/tournament/model/types";

type Props = {
  division: TournamentDivisionOption | undefined;
  selection: CanvasSelection;
  card: CanvasCard | undefined;
  matches: Match[];
  onAddPool: (phaseId: number, name: string) => void;
  onAddMatch: (poolId: number, name: string) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onDeleteRoute: (targetKind: "pool" | "match", targetId: number, slot: number) => void;
  onClearSelection: () => void;
};

const NOUN = { phase: "Phase", pool: "Pool", match: "Match" } as const;

/**
 * What is selected, and everything about its place in the structure.
 *
 * One panel serves both modes, because what somebody wants to know about a
 * thing they clicked does not change with what they are doing: the name is a
 * field rather than a rename dialog, and both sides of every route are here in
 * full, so a route drawn on the canvas can be read, checked and taken away in
 * the place it is written down.
 *
 * Nothing here opens a window over the canvas and nothing here writes. Every
 * edit goes into the draft the page commits in one go — which is also why the
 * routes are worth reading here: half of them may not exist yet.
 */
export default function StructureInspector({
  division,
  selection,
  card,
  matches,
  onAddPool,
  onAddMatch,
  onRename,
  onDelete,
  onDeleteRoute,
  onClearSelection,
}: Props) {
  const [name, setName] = useState("");
  const selected = selectedName(division, matches, selection);

  useEffect(() => setName(selected ?? ""), [selection?.kind, selection?.id, selected]);

  if (!selection || selected === undefined) {
    return (
      <aside className="flex h-full w-[280px] shrink-0 flex-col rounded-xl border border-ui-border bg-ui-surface p-3.5">
        <p className="text-[12px] leading-relaxed text-ui-text-mute">
          Select a phase, a pool or a match to edit it here. The dashed slots add one; a placement chip draws a route.
        </p>
      </aside>
    );
  }

  const phase = phaseOf(division, matches, selection);
  const pool = poolOf(division, matches, selection);
  const poolMatches = matches.filter((match) => match.phaseGroupId === pool?.id);
  const routes = selection.kind === "phase" ? { incoming: [], outgoing: [] } : routesOf(collectRoutes(division, matches), selection.kind, selection.id);

  return (
    <aside className="flex h-full w-[280px] shrink-0 flex-col overflow-y-auto rounded-xl border border-ui-border bg-ui-surface p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-ui-text-mute">{NOUN[selection.kind]}</span>
        <button type="button" onClick={onClearSelection} className={`${focusRing} text-[12px] text-ui-text-mute hover:text-ui-text`}>
          Clear
        </button>
      </div>

      <input
        value={name}
        aria-label="Name"
        onChange={(event) => setName(event.target.value)}
        onBlur={() => name.trim() && name.trim() !== selected && onRename(name.trim())}
        onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
        className={`mt-1.5 w-full rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-1.5 text-sm font-semibold text-ui-text outline-none ${focusRing}`}
      />

      <p className="mt-1.5 text-[12px] text-ui-text-mute">
        {division?.name}
        {selection.kind !== "phase" && phase ? <Crumb>{phase.name}</Crumb> : null}
        {selection.kind === "match" && pool ? <Crumb>{pool.name}</Crumb> : null}
      </p>

      {card && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-ui-separator px-2.5 py-2">
          <StatusIcon status={card.status} />
          <span className="text-[12px] text-ui-text-mute">{card.meta.join(" · ") || "nothing played yet"}</span>
        </div>
      )}

      {selection.kind !== "phase" && (
        <>
          <Section label="Comes from" />
          {routes.incoming.length === 0 ? (
            <Empty>Nothing arrives here yet.</Empty>
          ) : (
            <RouteList
              routes={routes.incoming}
              render={(rule) => (
                <>
                  <Pill>{rule.targetSlot}</Pill>
                  <span>is</span>
                  <Pill>{ordinal(rule.sourcePlacement)}</Pill>
                  <span>of</span>
                  <Pill>{rule.sourceName ?? "elsewhere"}</Pill>
                </>
              )}
              onDelete={onDeleteRoute}
            />
          )}

          <Section label="Goes to" />
          {routes.outgoing.length === 0 ? (
            <Empty>Nothing advances out of this {selection.kind} yet.</Empty>
          ) : (
            <RouteList
              routes={routes.outgoing}
              render={(rule) => (
                <>
                  <Pill>{ordinal(rule.sourcePlacement)}</Pill>
                  <span>goes to</span>
                  <Pill>{rule.targetName ?? "elsewhere"}</Pill>
                  <span>slot</span>
                  <Pill>{rule.targetSlot}</Pill>
                </>
              )}
              onDelete={onDeleteRoute}
            />
          )}
        </>
      )}

      {selection.kind === "phase" && phase && (
        <>
          <Section label="Pools" />
          <NameList names={(phase.phaseGroups ?? []).map((candidate) => candidate.name)} />
          <AddSlot noun="Pool" suggestedName={`Pool ${(phase.phaseGroups?.length ?? 0) + 1}`} onCreate={(next) => onAddPool(phase.id, next)} className="mt-1.5 h-9" />
        </>
      )}

      {selection.kind === "pool" && pool && (
        <>
          {/* A match is added where it belongs, which is inside a pool. */}
          <Section label="Matches" />
          <NameList names={poolMatches.map((match) => match.name)} />
          <AddSlot noun="Match" suggestedName={`Match ${poolMatches.length + 1}`} onCreate={(next) => onAddMatch(pool.id, next)} className="mt-1.5 h-9" />
        </>
      )}

      <div className="mt-auto flex items-center gap-2 border-t border-ui-separator pt-3.5">
        <button type="button" onClick={onDelete} className={`${btnDanger} text-xs`}>
          <FontAwesomeIcon icon={faTrash} className="mr-1.5 text-[10px]" />
          Delete {NOUN[selection.kind].toLowerCase()}
        </button>
        <span className="ml-auto text-[12px] text-ui-text-mute">Saved on Commit</span>
      </div>
    </aside>
  );
}

function Section({ label }: { label: string }) {
  return <div className="mt-4 text-[11px] font-bold uppercase tracking-[0.12em] text-ui-text-mute">{label}</div>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-[12px] text-ui-text-mute">{children}</p>;
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="rounded border border-ui-border bg-ui-raised px-1.5 font-semibold text-ui-text">{children}</span>;
}

function Crumb({ children }: { children: React.ReactNode }) {
  return (
    <>
      {" "}
      <span className="text-ui-border-strong">/</span> {children}
    </>
  );
}

function NameList({ names }: { names: string[] }) {
  if (names.length === 0) {
    return <Empty>None yet.</Empty>;
  }

  return (
    <ul className="mt-1.5 flex flex-col divide-y divide-ui-separator">
      {names.map((name) => (
        <li key={name} className="py-1.5 text-[12px] text-ui-text">
          {name}
        </li>
      ))}
    </ul>
  );
}

type RouteListProps = {
  routes: AdvancementRuleDto[];
  render: (rule: AdvancementRuleDto) => React.ReactNode;
  onDelete: (targetKind: "pool" | "match", targetId: number, slot: number) => void;
};

/** A route is taken away where it is read, by emptying the slot it filled. */
function RouteList({ routes, render, onDelete }: RouteListProps) {
  return (
    <ul className="mt-1.5 flex flex-col divide-y divide-ui-separator">
      {routes.map((rule) => (
        <li key={`${rule.targetKind}:${rule.targetId}:${rule.targetSlot}`} className="flex flex-wrap items-center gap-1 py-2 text-[12px] text-ui-text-mute">
          {render(rule)}
          <button
            type="button"
            aria-label={`Delete the route into slot ${rule.targetSlot} of ${rule.targetName ?? "elsewhere"}`}
            onClick={() => onDelete(rule.targetKind === "match" ? "match" : "pool", rule.targetId, rule.targetSlot)}
            className={`${btnTrash} ml-auto shrink-0`}
          >
            <FontAwesomeIcon icon={faTrash} className="text-[10px]" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function selectedName(division: TournamentDivisionOption | undefined, matches: Match[], selection: CanvasSelection): string | undefined {
  if (!selection) {
    return undefined;
  }
  if (selection.kind === "match") {
    return matches.find((match) => match.id === selection.id)?.name;
  }
  if (selection.kind === "phase") {
    return division?.phases.find((phase) => phase.id === selection.id)?.name;
  }

  return division?.phases.flatMap((phase) => phase.phaseGroups ?? []).find((pool) => pool.id === selection.id)?.name;
}

function poolOf(division: TournamentDivisionOption | undefined, matches: Match[], selection: CanvasSelection) {
  if (!selection || selection.kind === "phase") {
    return undefined;
  }
  const poolId = selection.kind === "pool" ? selection.id : matches.find((match) => match.id === selection.id)?.phaseGroupId;

  return division?.phases.flatMap((phase) => phase.phaseGroups ?? []).find((pool) => pool.id === poolId);
}

function phaseOf(division: TournamentDivisionOption | undefined, matches: Match[], selection: CanvasSelection): TournamentDivisionOptionPhase | undefined {
  if (!selection) {
    return undefined;
  }
  if (selection.kind === "phase") {
    return division?.phases.find((phase) => phase.id === selection.id);
  }

  const pool = poolOf(division, matches, selection);

  return division?.phases.find((phase) => (phase.phaseGroups ?? []).some((candidate) => candidate.id === pool?.id));
}
