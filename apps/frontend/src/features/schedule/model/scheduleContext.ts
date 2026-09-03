import type { TournamentDivisionOption } from "@/features/tournament/model/types";

/**
 * Where a match sits in the tournament, resolved from the structure the page
 * already holds.
 *
 * The board shows the division and nothing else — `Winners R2 M1` is a name
 * that repeats in every division, and one word settles which one it is, while
 * the phase and the pool are three words that do not fit on a card. The full
 * address belongs to the match detail, which has room for it.
 */

export function divisionNameOf(divisions: TournamentDivisionOption[], phaseGroupId: number): string | null {
    return divisions.find((division) => division.phases.some((phase) => phase.phaseGroups?.some((pool) => pool.id === phaseGroupId)))?.name ?? null;
}

export function divisionIdOf(divisions: TournamentDivisionOption[], phaseGroupId: number): number | null {
    return divisions.find((division) => division.phases.some((phase) => phase.phaseGroups?.some((pool) => pool.id === phaseGroupId)))?.id ?? null;
}

export function competitionAddressLabel(divisions: TournamentDivisionOption[], phaseGroupId: number): string {
    for (const division of divisions) {
        for (const phase of division.phases) {
            const pool = phase.phaseGroups?.find((candidate) => candidate.id === phaseGroupId);
            if (pool) {
                return `${division.name} · ${phase.name} · ${pool.name}`;
            }
        }
    }

    return "Tournament match";
}
