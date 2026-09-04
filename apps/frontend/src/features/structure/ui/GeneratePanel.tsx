import { useEffect, useMemo, useState } from "react";
import type { BracketType } from "@tournament-manager/brackets";
import type { StructurePlan } from "@tournament-manager/contracts";

import Select from "@/shared/components/ui/Select";
import { btnPrimary, btnSecondary, focusRing } from "@/styles/buttonStyles";
import { bracketTypes, generateBracketPlan } from "@/features/structure/model/generatorPlan";
import { formatBracketType } from "@/features/division/model/bracketType";
import { clearStructurePlanDraft, readStructurePlanDraft, writeStructurePlanDraft } from "@/shared/lib/structurePlanDraft";
import type { TournamentDivisionOption } from "@/features/tournament/model/types";

type Props = {
  tournamentId: number;
  division: TournamentDivisionOption;
  applying: boolean;
  onPreview: (plan: StructurePlan | null) => void;
  onApply: (plan: StructurePlan) => Promise<boolean>;
  onClose: () => void;
};

/**
 * Generating a bracket, with the preview on the canvas beside it.
 *
 * The generator is the pure function the API runs, so what the dashed column
 * shows is not an illustration: it is the plan, computed here, and Create sends
 * exactly it. Changing a field recomputes it, which is what makes "top two of
 * each pool" a thing you can look at before it exists.
 */
export default function GeneratePanel({ tournamentId, division, applying, onPreview, onApply, onClose }: Props) {
  const types = useMemo(bracketTypes, []);
  /* A draft survives a reload: nothing is written until Create, so losing the
     answers to a page refresh loses work somebody did. */
  const restored = useMemo(() => readStructurePlanDraft(tournamentId, division.id), [tournamentId, division.id]);
  const [bracketType, setBracketType] = useState<BracketType>(
    types.find((type) => type === restored?.bracketType) ?? types[0],
  );
  const [phaseName, setPhaseName] = useState(restored?.phaseName ?? "");
  const [playerPerMatch, setPlayerPerMatch] = useState(restored?.playerPerMatch ?? 2);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => writeStructurePlanDraft({ tournamentId, divisionId: division.id, bracketType, phaseName, playerPerMatch }),
    [tournamentId, division.id, bracketType, phaseName, playerPerMatch],
  );

  const generated = useMemo(() => {
    try {
      setError(null);
      return generateBracketPlan(
        {
          tournamentId,
          divisionId: division.id,
          divisionName: division.name,
          structureVersion: division.structureVersion,
          phaseName: phaseName.trim() || `Bracket ${division.phases.length + 1}`,
          poolName: "Bracket",
          bracketType,
          playerPerMatch,
        },
        division.entrantCount,
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "That bracket cannot be built.");
      return null;
    }
  }, [tournamentId, division, bracketType, phaseName, playerPerMatch]);

  /* The preview belongs to the canvas, so the panel hands it over rather than
     drawing a second, smaller copy of the same thing beside the real one. */
  useMemo(() => onPreview(generated?.plan ?? null), [generated, onPreview]);

  const matchCount = generated?.bracket.matches.length ?? 0;
  const routeCount = generated?.bracket.routes.length ?? 0;

  return (
    <aside className="flex h-full w-[280px] shrink-0 flex-col overflow-y-auto rounded-xl border border-ui-border bg-ui-surface p-3.5">
      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-ui-text-mute">Generate</div>

      <label className="mt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-ui-text-mute" htmlFor="generate-phase-name">
        Called
      </label>
      <input
        id="generate-phase-name"
        data-autofocus
        value={phaseName}
        placeholder={`Bracket ${division.phases.length + 1}`}
        onChange={(event) => setPhaseName(event.target.value)}
        className={`mt-1 w-full rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-1.5 text-sm font-semibold text-ui-text outline-none ${focusRing}`}
      />

      <label className="mt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-ui-text-mute" htmlFor="generate-shape">
        Shape
      </label>
      <Select
        inputId="generate-shape"
        value={bracketType}
        onChange={(type) => setBracketType(type as BracketType)}
        options={types.map((type) => ({ value: type, label: formatBracketType(type) ?? type }))}
        className="mt-1"
      />

      <label className="mt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-ui-text-mute" htmlFor="generate-players">
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
        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-ui-text-mute">This will create</div>
        <div className="mt-1.5 flex flex-col gap-1 text-[12px] text-ui-text">
          <span className="flex items-center gap-2">
            1 phase <span className="ml-auto text-[11px] text-ui-text-mute">{phaseName.trim() || `Bracket ${division.phases.length + 1}`}</span>
          </span>
          <span className="flex items-center gap-2">
            1 pool <span className="ml-auto text-[11px] text-ui-text-mute">Bracket</span>
          </span>
          <span className="flex items-center gap-2">
            {matchCount} {matchCount === 1 ? "match" : "matches"}
            <span className="ml-auto text-[11px] text-ui-text-mute">{division.entrantCount} entrants</span>
          </span>
          <span className="flex items-center gap-2">
            {routeCount} {routeCount === 1 ? "route" : "routes"}
            <span className="ml-auto text-[11px] text-ui-text-mute">{generated?.bracket.byes ?? 0} byes</span>
          </span>
        </div>
      </div>

      {error && <p className="mt-3 text-[11px] text-state-failed">{error}</p>}

      <p className="mt-3 text-[11px] leading-relaxed text-ui-text-mute">
        Nothing is written yet. The dashed column is exactly what Create will make, and every piece of it can be changed afterwards.
      </p>

      <div className="mt-auto flex items-center gap-2 border-t border-ui-separator pt-3.5">
        <button
          type="button"
          onClick={() => {
            clearStructurePlanDraft();
            onPreview(null);
            onClose();
          }}
          className={`${btnSecondary} text-xs`}
        >
          Discard
        </button>
        <button
          type="button"
          disabled={applying || !generated || matchCount === 0}
          onClick={async () => {
            if (!generated) return;
            if (await onApply(generated.plan)) {
              clearStructurePlanDraft();
              onPreview(null);
              onClose();
            }
          }}
          className={`${btnPrimary} ml-auto text-xs`}
        >
          {applying ? "Creating…" : "Create"}
        </button>
      </div>
    </aside>
  );
}
