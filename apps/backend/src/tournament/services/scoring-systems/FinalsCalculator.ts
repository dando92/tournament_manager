import { Standing } from "@persistence/entities";
import { IScoringSystem } from "./IScoringSystem";


export class FinalsCalculator extends IScoringSystem {
    constructor() {
        super();
    }

    getName(): string {
        return "EurocupFinalsScoringSystem";
    }

    getDescription(): string {
        return "First to n";
    }

    recalc(standings: Standing[]) {
        let orderedStandings = standings.sort((a, b) => Number(b.score.percentage) - Number(a.score.percentage)).sort((a, b) => b.score.isFailed ? 0 : 1);

        orderedStandings[0].points = 1;
        orderedStandings[1].points = 0;
    }
}
