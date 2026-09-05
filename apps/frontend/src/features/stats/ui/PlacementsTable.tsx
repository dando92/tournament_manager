import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp } from '@fortawesome/free-solid-svg-icons';
import type { DivisionPlacementRowDto, DivisionPlacementsDto } from '@tournament-manager/contracts';

import { percentage, placementLabel, seedSwing } from '@/features/stats/model/statsFormat';

/**
 * A division's final order.
 *
 * The place is the band the tournament actually settled, so two people it never
 * separated read `5-8` and neither of them is told they came fifth. `Reached`
 * names the competition they did not get past, which is what the band means.
 */
export default function PlacementsTable({ division }: { division: DivisionPlacementsDto }) {
    if (!division.complete) {
        return <p className="text-sm italic text-ui-text-mute">{division.divisionName} is still under way.</p>;
    }
    if (division.rows.length === 0) {
        return <p className="text-sm italic text-ui-text-mute">Nobody played a match in {division.divisionName}.</p>;
    }

    return (
        <div className="flex flex-col gap-2">
            {division.endings > 1 ? (
                <p className="text-xs text-ui-text-mute">
                    This division ends in {division.endings} places, so it has no single winner. The order below is read from how far each entrant got.
                </p>
            ) : null}
            <div className="overflow-x-auto rounded border border-ui-border">
                <table className="w-full min-w-[40rem] text-sm">
                    <thead className="bg-ui-raised text-xs uppercase tracking-wide text-ui-text-mute">
                        <tr>
                            <th className="px-3 py-2 text-left font-medium">Place</th>
                            <th className="px-3 py-2 text-left font-medium">Entrant</th>
                            <th className="px-3 py-2 text-right font-medium">Seed</th>
                            <th className="px-3 py-2 text-left font-medium">Reached</th>
                            <th className="px-3 py-2 text-right font-medium">Points</th>
                            <th className="px-3 py-2 text-right font-medium">Songs</th>
                            <th className="px-3 py-2 text-right font-medium">Average</th>
                        </tr>
                    </thead>
                    <tbody>
                        {division.rows.map((row) => (
                            <PlacementRow key={row.entrantId} row={row} />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function PlacementRow({ row }: { row: DivisionPlacementRowDto }) {
    const swing = seedSwing(row);

    return (
        <tr className="border-t border-ui-separator bg-ui-row">
            <td className="px-3 py-2 font-semibold tabular-nums text-ui-text">{placementLabel(row)}</td>
            <td className="px-3 py-2">
                <span className="text-ui-text">{row.playerName ?? row.entrantName}</span>
                {row.status !== 'active' ? <span className="ml-2 text-xs uppercase tracking-wide text-ui-text-mute">{row.status}</span> : null}
            </td>
            <td className="px-3 py-2 text-right tabular-nums text-ui-text-soft">
                {row.seedNum ?? '—'}
                {swing !== null && swing !== 0 ? (
                    <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs text-ui-text-mute">
                        <FontAwesomeIcon
                            icon={swing > 0 ? faCaretUp : faCaretDown}
                            className={swing > 0 ? 'text-state-done' : 'text-state-failed'}
                        />
                        {Math.abs(swing)}
                    </span>
                ) : null}
            </td>
            <td className="px-3 py-2 text-ui-text-soft">{row.exitName}</td>
            <td className="px-3 py-2 text-right tabular-nums text-ui-text-soft">{row.points}</td>
            <td className="px-3 py-2 text-right tabular-nums text-ui-text-soft">{row.songsPlayed}</td>
            <td className="px-3 py-2 text-right tabular-nums text-ui-text-soft">{percentage(row.averagePercentage)}</td>
        </tr>
    );
}
