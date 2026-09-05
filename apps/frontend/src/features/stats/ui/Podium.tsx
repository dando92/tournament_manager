import type { DivisionPlacementRowDto } from "@tournament-manager/contracts";

import { percentage, seedSwing } from "@/features/stats/model/statsFormat";
import Flag from "@/features/stats/ui/Flag";
import GradeMark from "@/features/stats/ui/GradeMark";
import Medal from "@/features/stats/ui/Medal";
import SeedSwing from "@/features/stats/ui/SeedSwing";

/**
 * The top of a finished division, drawn rather than tabulated.
 *
 * Three cards for the three places, the first at a different size because the
 * winner is not the second row of a list. A place several people share is one
 * card holding all of them, which is the honest shape for a band the tournament
 * never separated — a table row can only say that in small print.
 */
export default function Podium({ rows }: { rows: DivisionPlacementRowDto[] }) {
  const bands = topBands(rows);
  if (bands.length === 0) {
    return null;
  }

  return (
    <div className="grid items-end gap-3 md:grid-cols-[1.18fr_1fr_1fr]">
      {bands.map((band, index) => (index === 0 ? <WinnerCard key={band[0].entrantId} row={band[0]} /> : <BandCard key={band[0].entrantId} band={band} />))}
    </div>
  );
}

/** The first three placements, each as the whole band that shares it. */
function topBands(rows: DivisionPlacementRowDto[]): DivisionPlacementRowDto[][] {
  const bands: DivisionPlacementRowDto[][] = [];

  for (const row of rows) {
    if (row.placement > 3) {
      break;
    }
    const last = bands.at(-1);
    if (last && last[0].placement === row.placement) {
      last.push(row);
    } else {
      bands.push([row]);
    }
  }

  return bands;
}

function nameOf(row: DivisionPlacementRowDto): string {
  return row.playerName ?? row.entrantName;
}

function WinnerCard({ row }: { row: DivisionPlacementRowDto }) {
  const swing = seedSwing(row);

  return (
    <div className="relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-ui-border bg-ui-surface p-4 shadow-[0_3px_10px_0_rgb(var(--ui-shadow)/var(--ui-shadow-alpha))]">
      <span className="pointer-events-none absolute -right-6 -top-5 text-medal-gold/10">
        <Medal placement={1} size={150} />
      </span>
      <div className="relative flex items-center gap-2">
        <Medal placement={1} size={26} />
        <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-medal-gold">Winner</span>
      </div>
      <div className="relative flex items-center gap-2.5">
        <Flag nationality={row.nationality} />
        <span className="text-3xl font-extrabold leading-none tracking-tight text-ui-text">{nameOf(row)}</span>
      </div>
      <div className="relative flex items-center gap-4 text-ui-text-soft">
        <Figure label="Average">
          <span className="text-xl font-bold tabular-nums text-ui-text">{percentage(row.averagePercentage)}</span>
          <GradeMark percentage={row.averagePercentage} />
        </Figure>
        <span className="self-stretch border-l border-ui-separator" />
        <Figure label="Reached">
          <span className="text-sm font-semibold text-ui-text">{row.exitName}</span>
        </Figure>
        {row.seedNum !== null ? (
          <>
            <span className="self-stretch border-l border-ui-separator" />
            <Figure label="Seed">
              <span className="text-xl font-bold tabular-nums text-ui-text">{row.seedNum}</span>
              <SeedSwing swing={swing} />
            </Figure>
          </>
        ) : null}
      </div>
    </div>
  );
}

function BandCard({ band }: { band: DivisionPlacementRowDto[] }) {
  const placement = band[0].placement;
  const shared = band.length > 1;

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-ui-border bg-ui-surface p-4 shadow-[0_2px_6px_0_rgb(var(--ui-shadow)/var(--ui-shadow-alpha))]">
      <div className="flex items-center gap-2">
        <Medal placement={placement} size={20} />
        <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ui-text-mute">
          {placement === 2 ? "Second" : "Third"}
          {shared ? " — shared" : ""}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {band.map((row) => (
          <div key={row.entrantId} className="flex items-center gap-2.5">
            <Flag nationality={row.nationality} />
            <span className={`truncate font-bold text-ui-text ${shared ? "text-base" : "text-2xl leading-tight tracking-tight"}`}>{nameOf(row)}</span>
            <span className="ml-auto flex shrink-0 items-center gap-2">
              <span className="text-sm font-semibold tabular-nums text-ui-text-soft">{percentage(row.averagePercentage)}</span>
              <GradeMark percentage={row.averagePercentage} />
            </span>
          </div>
        ))}
      </div>
      {shared ? <p className="text-[11px] leading-snug text-ui-text-mute">Nothing played separated them.</p> : null}
    </div>
  );
}

function Figure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.09em] text-ui-text-mute">{label}</span>
      <span className="flex items-baseline gap-1.5">{children}</span>
    </div>
  );
}
