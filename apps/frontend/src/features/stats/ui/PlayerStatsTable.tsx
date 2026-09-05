import type { PlayerStatsRowDto } from '@tournament-manager/contracts';

import { percentage, share } from '@/features/stats/model/statsFormat';

/**
 * What each player did across the whole tournament.
 *
 * The average and the best are taken over the runs that cleared, so the fail
 * count is read beside them rather than folded into them: a low average and a
 * high fail rate are two different ways to have a hard day.
 */
export default function PlayerStatsTable({ rows }: { rows: PlayerStatsRowDto[] }) {
    return (
        <div className="overflow-x-auto rounded border border-ui-border">
            <table className="w-full min-w-[42rem] text-sm">
                <thead className="bg-ui-raised text-xs uppercase tracking-wide text-ui-text-mute">
                    <tr>
                        <th className="px-3 py-2 text-left font-medium">Player</th>
                        <th className="px-3 py-2 text-right font-medium">Points</th>
                        <th className="px-3 py-2 text-right font-medium">Songs</th>
                        <th className="px-3 py-2 text-right font-medium">Average</th>
                        <th className="px-3 py-2 text-right font-medium">Best</th>
                        <th className="px-3 py-2 text-right font-medium">Failed</th>
                        <th className="px-3 py-2 text-right font-medium">Matches won</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.playerId} className="border-t border-ui-separator bg-ui-row">
                            <td className="px-3 py-2 text-ui-text">{row.playerName}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-ui-text-soft">{row.points}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-ui-text-soft">{row.songsPlayed}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-ui-text-soft">{percentage(row.averagePercentage)}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-ui-text-soft">{percentage(row.bestPercentage)}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-ui-text-soft">
                                {row.failedCount}
                                <span className="ml-1 text-xs text-ui-text-mute">{share(row.failedCount, row.songsPlayed)}</span>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-ui-text-soft">
                                {row.matchesWon} / {row.matchesPlayed}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
