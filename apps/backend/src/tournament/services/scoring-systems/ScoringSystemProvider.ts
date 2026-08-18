import { Injectable } from "@nestjs/common";
import { IScoringSystem } from "./IScoringSystem";
import { EurocupScoreCalculator } from "./EurocupScoreCalculator";
import { FinalsCalculator } from "./FinalsCalculator";


@Injectable()
export class ScoringSystemProvider {
    private readonly systems: Map<string, IScoringSystem>;
    constructor() {
        const all: IScoringSystem[] = [new EurocupScoreCalculator(), new FinalsCalculator()];
        this.systems = new Map(all.map(s => [s.getName(), s]));
    }

    getScoringSystem(name: string): IScoringSystem {
        return this.systems.get(name);
    }

    getAll(): string[] {
        return Array.from(this.systems.keys());
    }
}
