import type { BracketGenerator } from './bracket-generator';
import { DoubleElimination } from './double-elimination';
import { Manual } from './manual';
import { SingleElimination } from './single-elimination';
import { type BracketType, isBracketType } from './bracket-type';

/**
 * The shapes on offer, keyed by identifier.
 *
 * A generator reaches this registry only once it builds something. King of the
 * Hill was registered with an empty body, so choosing it created a phase, an
 * empty pool and nothing else while the dialog reported success - see FQ-050.
 */
export class BracketGeneratorProvider {
    private readonly generators: Map<BracketType, BracketGenerator>;

    constructor() {
        const generators: BracketGenerator[] = [new SingleElimination(), new DoubleElimination(), new Manual()];
        this.generators = new Map(generators.map((generator) => [generator.type, generator]));
    }

    getGenerator(name: string): BracketGenerator | undefined {
        return isBracketType(name) ? this.generators.get(name) : undefined;
    }

    getAll(): BracketType[] {
        return Array.from(this.generators.keys());
    }
}
