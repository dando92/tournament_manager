import type { SongStatsRowDto } from '@tournament-manager/contracts';

import { decimal, percentage, share } from '@/features/stats/model/statsFormat';

/**
 * How each song of the pool was actually played.
 *
 * `Spread` is the deviation of the runs that cleared, and it is the column that
 * says whether a song did any work: a low spread is a song everybody passed
 * alike, which decided nothing however hard it was.
 */
export default function SongStatsTable({ rows }: { rows: SongStatsRowDto[] }) {
    return (
        <div className="overflow-x-auto rounded border border-ui-border">
            <table className="w-full min-w-[44rem] text-sm">
                <thead className="bg-ui-raised text-xs uppercase tracking-wide text-ui-text-mute">
                    <tr>
                        <th className="px-3 py-2 text-left font-medium">Song</th>
                        <th className="px-3 py-2 text-right font-medium">Meter</th>
                        <th className="px-3 py-2 text-right font-medium">Runs</th>
                        <th className="px-3 py-2 text-right font-medium">Players</th>
                        <th className="px-3 py-2 text-right font-medium">Average</th>
                        <th className="px-3 py-2 text-right font-medium">Best</th>
                        <th className="px-3 py-2 text-right font-medium">Failed</th>
                        <th className="px-3 py-2 text-right font-medium">Spread</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.songId} className="border-t border-ui-separator bg-ui-row">
                            <td className="px-3 py-2">
                                <span className="text-ui-text">{row.title}</span>
                                <span className="ml-2 text-xs text-ui-text-mute">{row.group}</span>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-ui-text-soft">{row.difficulty}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-ui-text-soft">{row.playedCount}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-ui-text-soft">{row.playerCount}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-ui-text-soft">{percentage(row.averagePercentage)}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-ui-text-soft">{percentage(row.bestPercentage)}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-ui-text-soft">
                                {row.failedCount}
                                <span className="ml-1 text-xs text-ui-text-mute">{share(row.failedCount, row.playedCount)}</span>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-ui-text-soft">{decimal(row.percentageSpread)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
