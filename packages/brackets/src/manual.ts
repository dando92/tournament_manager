import type { BracketPlan, BracketPlanInput } from './bracket-plan';
import { BracketPlanBuilder } from './bracket-plan-builder';
import type { BracketGenerator } from './bracket-generator';

/**
 * One round and nothing after it.
 *
 * The entrants are dealt into as many matches as they fill, and where they go
 * next is left to whoever is building the tournament. It is the shape to pick
 * when only the first phase is known.
 */
export class Manual implements BracketGenerator {
    readonly type = 'Manual' as const;

    generate(input: BracketPlanInput): BracketPlan {
        const playerPerMatch = input.playerPerMatch ?? 2;
        if (playerPerMatch < 2) {
            throw new Error(`A match holds at least two players, got ${playerPerMatch}`);
        }

        /* One round of equals: none of them is a final, so the shared naming
           that reads the last rounds as finals is not the right default here. */
        const builder = new BracketPlanBuilder(input.name ?? ((descriptor) => `Match ${descriptor.matchIndex + 1}`));
        const matchCount = Math.ceil(input.entrantCount / playerPerMatch);
        const matches = builder.addRound('single', 0, 1, matchCount, 'Round 1');
        builder.seatFirstWave(matches, input.entrantCount, playerPerMatch);

        return builder.build(this.type, input.entrantCount, playerPerMatch, matchCount * playerPerMatch - input.entrantCount);
    }
}
