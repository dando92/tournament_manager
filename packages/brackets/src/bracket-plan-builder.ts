import {
    type BracketMatchNamer,
    type BracketPlan,
    type BracketPlanMatch,
    type BracketPlanRoute,
    type BracketPlanSeat,
    type BracketRoundKind,
    defaultMatchName,
} from './bracket-plan';
import type { BracketType } from './bracket-type';

/**
 * The mutable side of building a plan.
 *
 * The generators read almost exactly like the ones they replace: a round is
 * added and hands back the identifiers of its matches, and rules are written
 * against those. What changed is that `addRound` returns rather than awaits,
 * so a generator is a function of its inputs and can be run without a database.
 */
export class BracketPlanBuilder {
    private readonly matches: BracketPlanMatch[] = [];
    private readonly routes: BracketPlanRoute[] = [];
    private readonly seats: BracketPlanSeat[] = [];

    constructor(private readonly name: BracketMatchNamer = defaultMatchName) {}

    /** Adds one round and returns its match identifiers, in order. */
    addRound(kind: BracketRoundKind, roundIndex: number, roundCount: number, matchCount: number, round: string): string[] {
        const localIds: string[] = [];
        for (let matchIndex = 0; matchIndex < matchCount; matchIndex++) {
            const localId = `m${this.matches.length}`;
            const name = this.name({ kind, roundIndex, roundCount, matchIndex, matchCount });
            this.matches.push({ localId, name, round });
            localIds.push(localId);
        }

        return localIds;
    }

    /** Placement and slot arrive 0-based, the way the bracket arithmetic counts them. */
    addRoute(sourceMatchLocalId: string, sourcePlacementIndex: number, targetMatchLocalId: string, targetSlotIndex: number): void {
        this.routes.push({
            sourceMatchLocalId,
            sourcePlacement: sourcePlacementIndex + 1,
            targetMatchLocalId,
            targetSlot: targetSlotIndex + 1,
        });
    }

    /**
     * Seats the entrants in the order the division seeded them: the first
     * `playerPerMatch` of them into the first match, and so on. Entrants beyond
     * the first round's capacity are not seated, which is what a bye is.
     */
    seatFirstWave(firstRound: string[], entrantCount: number, playerPerMatch: number): void {
        for (let seedIndex = 0; seedIndex < entrantCount; seedIndex++) {
            const matchIndex = Math.floor(seedIndex / playerPerMatch);
            if (matchIndex >= firstRound.length) {
                continue;
            }
            this.seats.push({ matchLocalId: firstRound[matchIndex], slot: (seedIndex % playerPerMatch) + 1, seedIndex });
        }
    }

    build(bracketType: BracketType, entrantCount: number, playerPerMatch: number, byes: number): BracketPlan {
        return {
            bracketType,
            playerPerMatch,
            entrantCount,
            byes,
            matches: this.matches,
            routes: this.routes,
            seats: this.seats,
        };
    }
}
