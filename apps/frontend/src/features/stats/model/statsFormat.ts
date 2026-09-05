import type { DivisionPlacementRowDto } from '@tournament-manager/contracts';

/** A place a reader can say: `3` alone, `5-8` when the tournament never separated them. */
export function placementLabel(row: Pick<DivisionPlacementRowDto, 'placement' | 'sharedThrough'>): string {
    return row.placement === row.sharedThrough ? String(row.placement) : `${row.placement}-${row.sharedThrough}`;
}

/**
 * How far a seed beat its own expectation.
 *
 * Positive is somebody who finished above where they were seeded. A band is
 * measured from where it starts, because that is the best the tournament is
 * willing to say about anybody in it. Null when there was no seed to beat.
 */
export function seedSwing(row: Pick<DivisionPlacementRowDto, 'placement' | 'seedNum'>): number | null {
    return row.seedNum === null ? null : row.seedNum - row.placement;
}

export function percentage(value: number | null): string {
    return value === null ? '—' : `${value.toFixed(2)}%`;
}

export function decimal(value: number | null, digits = 2): string {
    return value === null ? '—' : value.toFixed(digits);
}

export function share(part: number, whole: number): string {
    return whole === 0 ? '—' : `${Math.round((part / whole) * 100)}%`;
}
