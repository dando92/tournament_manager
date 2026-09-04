import { useMemo, useState } from "react";
import type { BracketPlan, BracketType } from "@tournament-manager/brackets";

import Select from "@/shared/components/ui/Select";
import { btnPrimary, btnSecondary, focusRing } from "@/styles/buttonStyles";
import { bracketTypes, generateBracket } from "@/features/structure/model/bracketCatalogue";
import { formatBracketType } from "@/features/division/model/bracketType";
import type { BracketRequest } from "@/features/structure/model/structureDraft";
import type { TournamentDivisionOption } from "@/features/tournament/model/types";

type Props = {
  division: TournamentDivisionOption;
  onAdd: (request: BracketRequest) => void;
  onClose: () => void;
};

/**
 * Generating a bracket, into the draft the rest of the page is building.
 *
 * The generator is the pure function the API runs, and what it answers goes
 * straight into the draft: the bracket arrives on the canvas as dashed cards
 * with its routes already drawn, in the column it will occupy, and Commit sends
 * it along with everything else somebody did. There is no preview to keep in
 * step with the plan, because the preview is the plan.
 *
 * That is also what makes this one page for all three producers. Typing a
 * structure, generating one and importing one are three ways of filling one
 * draft, and only one thing on the page writes.
 */
export default function GeneratePanel({ division, onAdd, onClose }: Props) {
  const types = useMemo(bracketTypes, []);
  const [bracketType, setBracketType] = useState<BracketType>(types[0]);
  const [phaseName, setPhaseName] = useState("");
  const [playerPerMatch, setPlayerPerMatch] = useState(2);

  const suggested = `Bracket ${division.phases.length + 1}`;
  const generated = useMemo(() => attempt(bracketType, division.entrantCount, playerPerMatch), [bracketType, division.entrantCount, playerPerMatch]);

  const matchCount = generated.bracket?.matches.length ?? 0;
  const routeCount = generated.bracket?.routes.length ?? 0;

  return (
    <aside className="flex h-full w-[280px] shrink-0 flex-col overflow-y-auto rounded-xl border border-ui-border bg-ui-surface p-3.5">
      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-ui-text-mute">Generate</div>

      <label className="mt-3 text-[11px] font-bold uppercase tracking-[0.12em] text-ui-text-mute" htmlFor="generate-phase-name">
        Called
      </label>
      <input
        id="generate-phase-name"
        data-autofocus
        value={phaseName}
        placeholder={suggested}
        onChange={(event) => setPhaseName(event.target.value)}
        className={`mt-1 w-full rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-1.5 text-sm font-semibold text-ui-text outline-none ${focusRing}`}
      />

      <label className="mt-3 text-[11px] font-bold uppercase tracking-[0.12em] text-ui-text-mute" htmlFor="generate-shape">
        Shape
      </label>
      <Select
        inputId="generate-shape"
        value={bracketType}
        onChange={(type) => setBracketType(type as BracketType)}
        options={types.map((type) => ({ value: type, label: formatBracketType(type) ?? type }))}
        className="mt-1"
      />

      <label className="mt-3 text-[11px] font-bold uppercase tracking-[0.12em] text-ui-text-mute" htmlFor="generate-players">
        Players per match
      </label>
      <input
        id="generate-players"
        type="number"
        min={2}
        value={playerPerMatch}
        onChange={(event) => setPlayerPerMatch(Number(event.target.value))}
        className={`mt-1 w-full rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-1.5 text-sm font-semibold text-ui-text outline-none ${focusRing}`}
      />

      <div className="mt-4 rounded-lg border border-ui-separator px-2.5 py-2">
        <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-ui-text-mute">This will add</div>
        <div className="mt-1.5 flex flex-col gap-1 text-[12px] text-ui-text">
          <span className="flex items-center gap-2">
            1 phase <span className="ml-auto text-[12px] text-ui-text-mute">{phaseName.trim() || suggested}</span>
          </span>
          <span className="flex items-center gap-2">
            1 pool <span className="ml-auto text-[12px] text-ui-text-mute">Bracket</span>
          </span>
          <span className="flex items-center gap-2">
            {matchCount} {matchCount === 1 ? "match" : "matches"}
            <span className="ml-auto text-[12px] text-ui-text-mute">{division.entrantCount} entrants</span>
          </span>
          <span className="flex items-center gap-2">
            {routeCount} {routeCount === 1 ? "route" : "routes"}
            <span className="ml-auto text-[12px] text-ui-text-mute">{generated.bracket?.byes ?? 0} byes</span>
          </span>
        </div>
      </div>

      {generated.error && <p className="mt-3 text-[12px] text-state-failed">{generated.error}</p>}

      <p className="mt-3 text-[12px] leading-relaxed text-ui-text-mute">
        It arrives on the canvas as a dashed column you can rename, re-route and add to. Nothing is written until Commit.
      </p>

      <div className="mt-auto flex items-center gap-2 border-t border-ui-separator pt-3.5">
        <button type="button" onClick={onClose} className={`${btnSecondary} text-xs`}>
          Cancel
        </button>
        <button
          type="button"
          disabled={!generated.bracket || matchCount === 0}
          onClick={() => {
            if (!generated.bracket) return;
            onAdd({ phaseName: phaseName.trim() || suggested, poolName: "Bracket", bracket: generated.bracket });
            onClose();
          }}
          className={`${btnPrimary} ml-auto text-xs`}
        >
          Add to draft
        </button>
      </div>
    </aside>
  );
}

/** A shape that refuses these numbers says so where the numbers are. */
function attempt(bracketType: BracketType, entrantCount: number, playerPerMatch: number): { bracket: BracketPlan | null; error: string | null } {
  try {
    return { bracket: generateBracket(bracketType, entrantCount, playerPerMatch), error: null };
  } catch (failure) {
    return { bracket: null, error: failure instanceof Error ? failure.message : "That bracket cannot be built." };
  }
}
