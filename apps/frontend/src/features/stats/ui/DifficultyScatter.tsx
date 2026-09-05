import type { SongStatsRowDto } from '@tournament-manager/contracts';

/**
 * Declared difficulty against how people actually scored.
 *
 * The meter a song carries is a claim; the average of what the field ran on it
 * is the measurement. A song sitting well above the trend of its neighbours was
 * easier than it says, one below was harder, and that is the reading this exists
 * to give — which is why it is a scatter and not a ranking.
 *
 * Drawn by hand rather than by a charting library: three marks, two axes and a
 * grid, in the tokens the rest of the interface already uses. The points are
 * neutral because difficulty is the axis, not the colour.
 */

const WIDTH = 720;
const HEIGHT = 320;
const PADDING = { left: 46, right: 16, top: 14, bottom: 34 };

type Plotted = { row: SongStatsRowDto; average: number };

export default function DifficultyScatter({ rows }: { rows: SongStatsRowDto[] }) {
    const plotted: Plotted[] = rows
        .filter((row): row is SongStatsRowDto & { averagePercentage: number } => row.averagePercentage !== null)
        .map((row) => ({ row, average: row.averagePercentage as number }));

    if (plotted.length < 2) {
        return <p className="text-sm italic text-ui-text-mute">Not enough cleared runs to plot yet.</p>;
    }

    const difficulties = plotted.map((point) => point.row.difficulty);
    const averages = plotted.map((point) => point.average);
    const xDomain = padded(Math.min(...difficulties), Math.max(...difficulties), 1);
    const yDomain = padded(Math.min(...averages), Math.max(...averages), 2);

    const x = (value: number) => PADDING.left + ((value - xDomain[0]) / (xDomain[1] - xDomain[0])) * (WIDTH - PADDING.left - PADDING.right);
    const y = (value: number) => HEIGHT - PADDING.bottom - ((value - yDomain[0]) / (yDomain[1] - yDomain[0])) * (HEIGHT - PADDING.top - PADDING.bottom);

    return (
        <div className="overflow-x-auto rounded border border-ui-border bg-ui-surface p-2">
            <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full min-w-[26rem]" role="img" aria-label="Declared difficulty against average percentage">
                {ticks(yDomain, 5).map((value) => (
                    <g key={`y-${value}`}>
                        <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={y(value)} y2={y(value)} className="stroke-ui-separator" strokeWidth={1} />
                        <text x={PADDING.left - 8} y={y(value) + 3} textAnchor="end" fontSize={10} className="fill-ui-text-mute">
                            {value}%
                        </text>
                    </g>
                ))}
                {ticks(xDomain, xDomain[1] - xDomain[0] > 12 ? 2 : 1).map((value) => (
                    <text key={`x-${value}`} x={x(value)} y={HEIGHT - PADDING.bottom + 16} textAnchor="middle" fontSize={10} className="fill-ui-text-mute">
                        {value}
                    </text>
                ))}
                <line
                    x1={PADDING.left}
                    x2={WIDTH - PADDING.right}
                    y1={HEIGHT - PADDING.bottom}
                    y2={HEIGHT - PADDING.bottom}
                    className="stroke-ui-border-strong"
                    strokeWidth={1}
                />
                {plotted.map((point) => (
                    <circle
                        key={point.row.songId}
                        cx={x(point.row.difficulty)}
                        cy={y(point.average)}
                        r={4}
                        className="fill-ui-text-mute/50 stroke-ui-surface"
                        strokeWidth={1}
                    >
                        <title>{`${point.row.title} — meter ${point.row.difficulty}, ${point.average.toFixed(2)}% over ${point.row.playedCount} runs`}</title>
                    </circle>
                ))}
                <text x={WIDTH - PADDING.right} y={HEIGHT - 4} textAnchor="end" fontSize={10} className="fill-ui-text-mute">
                    declared difficulty
                </text>
            </svg>
        </div>
    );
}

/** A domain with room around it, so a point never sits on an axis and a flat one still has height. */
function padded(low: number, high: number, margin: number): [number, number] {
    return [low - margin, high + margin];
}

/** Round tick values inside a domain, at the given step. */
function ticks([low, high]: [number, number], step: number): number[] {
    const first = Math.ceil(low / step) * step;
    const values: number[] = [];

    for (let value = first; value <= high; value += step) {
        values.push(Math.round(value * 100) / 100);
    }

    return values;
}
