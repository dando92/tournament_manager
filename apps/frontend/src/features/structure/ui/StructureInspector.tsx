import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash } from "@fortawesome/free-solid-svg-icons";

import StatusIcon from "@/shared/components/ui/StatusIcon";
import { btnDanger, btnSecondary, btnTrash, focusRing } from "@/styles/buttonStyles";
import { ordinal, type CanvasCard, type CanvasSelection } from "@/features/structure/model/structureCanvas";
import type { Match } from "@/features/match/model/types";
import type { TournamentDivisionOption } from "@/features/tournament/model/types";

type Props = {
  division: TournamentDivisionOption | undefined;
  selection: CanvasSelection;
  card: CanvasCard | undefined;
  matches: Match[];
  onRename: (name: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onEditRoutes: () => void;
  onDeleteRoute: (ruleId: number) => Promise<void>;
  onClearSelection: () => void;
};

/**
 * What is selected, and everything that can be done to it.
 *
 * The panel replaces the dialogs one noun at a time used to need: the name is a
 * field rather than a rename dialog, the routes are the sentence the advancement
 * editor already draws, and the danger action sits at the bottom behind its own
 * confirmation. Nothing here opens a window over the canvas, which is the point.
 */
export default function StructureInspector({
  division,
  selection,
  card,
  matches,
  onRename,
  onDelete,
  onEditRoutes,
  onDeleteRoute,
  onClearSelection,
}: Props) {
  const [name, setName] = useState(card?.name ?? "");

  useEffect(() => setName(card?.name ?? ""), [card?.key, card?.name]);

  if (!selection || !card) {
    return (
      <aside className="flex h-full w-[280px] shrink-0 flex-col rounded-xl border border-ui-border bg-ui-surface p-3.5">
        <p className="text-[12px] leading-relaxed text-ui-text-mute">
          Select a pool or a match to edit it here. The dashed slots add one; a placement chip draws a route.
        </p>
      </aside>
    );
  }

  const phase = division?.phases.find((candidate) =>
    selection.kind === "pool"
      ? (candidate.phaseGroups ?? []).some((pool) => pool.id === selection.id)
      : (candidate.phaseGroups ?? []).some((pool) => matches.some((match) => match.id === selection.id && match.phaseGroupId === pool.id)),
  );
  const pool =
    selection.kind === "pool"
      ? (phase?.phaseGroups ?? []).find((candidate) => candidate.id === selection.id)
      : (phase?.phaseGroups ?? []).find((candidate) => matches.some((match) => match.id === selection.id && match.phaseGroupId === candidate.id));
  const rules = selection.kind === "pool" ? (pool?.advancementRules ?? []).filter((rule) => rule.sourceKind === "phase_group") : [];
  const poolMatches = matches.filter((match) => match.phaseGroupId === pool?.id);

  return (
    <aside className="flex h-full w-[280px] shrink-0 flex-col overflow-y-auto rounded-xl border border-ui-border bg-ui-surface p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-ui-text-mute">{selection.kind === "pool" ? "Pool" : "Match"}</span>
        <button type="button" onClick={onClearSelection} className={`${focusRing} text-[12px] text-ui-text-mute hover:text-ui-text`}>
          Clear
        </button>
      </div>

      <input
        value={name}
        aria-label="Name"
        onChange={(event) => setName(event.target.value)}
        onBlur={() => name.trim() && name.trim() !== card.name && void onRename(name.trim())}
        onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
        className={`mt-1.5 w-full rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-1.5 text-sm font-semibold text-ui-text outline-none ${focusRing}`}
      />

      <p className="mt-1.5 text-[12px] text-ui-text-mute">
        {division?.name} <span className="text-ui-border-strong">/</span> {phase?.name}
        {selection.kind === "match" && pool ? (
          <>
            {" "}
            <span className="text-ui-border-strong">/</span> {pool.name}
          </>
        ) : null}
      </p>

      <div className="mt-3 flex items-center gap-2 rounded-lg border border-ui-separator px-2.5 py-2">
        <StatusIcon status={card.status} />
        <span className="text-[12px] text-ui-text-mute">{card.meta.join(" · ")}</span>
      </div>

      {selection.kind === "pool" && (
        <>
          <div className="mt-4 text-[11px] font-bold uppercase tracking-[0.12em] text-ui-text-mute">Advancement</div>
          {rules.length === 0 ? (
            <p className="mt-1.5 text-[12px] text-ui-text-mute">Nothing advances out of this pool yet.</p>
          ) : (
            <ul className="mt-1.5 flex flex-col divide-y divide-ui-separator">
              {rules.map((rule) => (
                <li key={rule.id} className="flex flex-wrap items-center gap-1 py-2 text-[12px] text-ui-text-mute">
                  <span className="rounded border border-ui-border bg-ui-raised px-1.5 font-semibold text-ui-text">{ordinal(rule.sourcePlacement)}</span>
                  <span>place goes to</span>
                  <span className="rounded border border-ui-border bg-ui-raised px-1.5 font-semibold text-ui-text">{rule.targetName ?? "elsewhere"}</span>
                  <span>slot</span>
                  <span className="rounded border border-ui-border bg-ui-raised px-1.5 font-semibold text-ui-text">{rule.targetSlot}</span>
                  <button
                    type="button"
                    aria-label={`Delete the route out of ${ordinal(rule.sourcePlacement)} place`}
                    onClick={() => void onDeleteRoute(rule.id)}
                    className={`${btnTrash} ml-auto shrink-0`}
                  >
                    <FontAwesomeIcon icon={faTrash} className="text-[10px]" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={onEditRoutes} className={`${btnSecondary} mt-2 w-full text-xs`}>
            Edit routes
          </button>

          <div className="mt-4 text-[11px] font-bold uppercase tracking-[0.12em] text-ui-text-mute">Matches</div>
          {poolMatches.length === 0 ? (
            <p className="mt-1.5 text-[12px] text-ui-text-mute">
              {card.meta[0]}. Switch to the match density to see them.
            </p>
          ) : (
            <ul className="mt-1.5 flex flex-col divide-y divide-ui-separator">
              {poolMatches.map((match) => (
                <li key={match.id} className="py-1.5 text-[12px] text-ui-text">
                  {match.name}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {selection.kind === "match" && card.slots.length > 0 && (
        <>
          <div className="mt-4 text-[11px] font-bold uppercase tracking-[0.12em] text-ui-text-mute">Who plays</div>
          <ul className="mt-1.5 flex flex-col divide-y divide-ui-separator">
            {card.slots.map((slot) => (
              <li key={slot.slot} className="flex items-center gap-2 py-2 text-[12px] text-ui-text-mute">
                <span className="rounded border border-ui-border bg-ui-raised px-1.5 font-semibold text-ui-text">{slot.slot}</span>
                <span className="italic">{slot.from ?? "nobody yet"}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-auto flex items-center gap-2 border-t border-ui-separator pt-3.5">
        <button type="button" onClick={() => void onDelete()} className={`${btnDanger} text-xs`}>
          <FontAwesomeIcon icon={faTrash} className="mr-1.5 text-[10px]" />
          Delete {selection.kind === "pool" ? "pool" : "match"}
        </button>
        <span className="ml-auto text-[12px] text-ui-text-mute">Saved as you go</span>
      </div>
    </aside>
  );
}
