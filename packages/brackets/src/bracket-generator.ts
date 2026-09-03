import type { BracketPlan, BracketPlanInput } from './bracket-plan';
import type { BracketType } from './bracket-type';

/**
 * A bracket shape, as a pure function of how many people are entered and how
 * many of them play at once.
 *
 * Nothing here reaches a database, a clock or a random source, so the same call
 * made in a browser to draw a preview and made by the API to persist one
 * returns the same plan.
 */
export interface BracketGenerator {
    readonly type: BracketType;
    generate(input: BracketPlanInput): BracketPlan;
}
