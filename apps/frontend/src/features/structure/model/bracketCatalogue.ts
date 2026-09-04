import { BracketGeneratorProvider, type BracketPlan, type BracketType } from "@tournament-manager/brackets";

/**
 * The bracket shapes, as the page reaches them.
 *
 * The generator is the same pure function the API runs, so what lands on the
 * canvas is not an illustration of what would be built: it is the graph, added
 * to the draft, and Commit sends it. There is no second representation to keep
 * in step with the first.
 */

const generators = new BracketGeneratorProvider();

export function bracketTypes(): BracketType[] {
    return generators.getAll();
}

export function generateBracket(bracketType: BracketType, entrantCount: number, playerPerMatch: number): BracketPlan {
    const generator = generators.getGenerator(bracketType);
    if (!generator) {
        throw new Error(`${bracketType} is not a bracket this can build.`);
    }

    return generator.generate({ entrantCount, playerPerMatch });
}
