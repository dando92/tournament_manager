/** What one match of a pool gave one of its entrants. */
export type PoolTotal = {
    entrantId: number;
    points: number;
};

/**
 * Every entrant of a pool with the points its matches gave them, best first.
 *
 * This is the pool's own verdict, and two readers take it differently. The
 * advancement rules need a position per entrant and therefore an order with no
 * ties in it, which is why an equal total falls back to the entrant. A final
 * placement reads the points instead and lets an equal total stay equal: the
 * order the fallback produces is arbitrary, and arbitrary is fine for choosing
 * which of two equal entrants takes slot 1 and not for telling somebody they
 * came fourth.
 */
export function poolTotals(matches: PoolTotal[][]): PoolTotal[] {
    const totals = new Map<number, number>();

    for (const match of matches) {
        for (const entry of match) {
            totals.set(entry.entrantId, (totals.get(entry.entrantId) ?? 0) + entry.points);
        }
    }

    return [...totals.entries()]
        .map(([entrantId, points]) => ({ entrantId, points }))
        .sort((left, right) => right.points - left.points || left.entrantId - right.entrantId);
}
