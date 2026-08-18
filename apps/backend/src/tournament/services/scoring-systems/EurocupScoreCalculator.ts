import { Standing } from "@persistence/entities";
import { IScoringSystem } from "./IScoringSystem";


export class EurocupScoreCalculator extends IScoringSystem {
    constructor() {
        super();
    }

    getName(): string {
        return "EurocupScoreCalculator";
    }

    getDescription(): string {
        return "Fail count 0";
    }

    recalc(standings: Standing[]) {
        let maxPoints = standings.length;
        let orderedStandings = standings.filter(s => !s.score.isFailed).sort((a, b) => Number(b.score.percentage) - Number(a.score.percentage));
        let tieCount = 0;

        for (let i = 0; i < orderedStandings.length; i++) {
            orderedStandings[i].points = Math.floor(maxPoints);

            if (i + 1 < orderedStandings.length) {
                if (Number(orderedStandings[i].score.percentage) > Number(orderedStandings[i + 1].score.percentage)) {
                    if (tieCount > 0) {
                        maxPoints -= tieCount;
                        tieCount = 0;
                    }
                    maxPoints--;
                } else if (Number(orderedStandings[i].score.percentage) === Number(orderedStandings[i + 1].score.percentage)) {
                    tieCount++;
                }
            }
        }
    }
}
