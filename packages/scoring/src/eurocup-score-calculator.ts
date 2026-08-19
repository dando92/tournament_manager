import type { ScoringStanding } from './scoring-standing';
import type { ScoringSystem } from './scoring-system';

export class EurocupScoreCalculator implements ScoringSystem {
  getName(): 'EurocupScoreCalculator' {
    return 'EurocupScoreCalculator';
  }

  getDescription(): string {
    return 'Fail count 0';
  }

  recalc(standings: ScoringStanding[]): void {
    let maxPoints = standings.length;
    const orderedStandings = standings
      .filter((standing) => !standing.score.isFailed)
      .sort(
        (left, right) =>
          Number(right.score.percentage) - Number(left.score.percentage),
      );
    let tieCount = 0;

    for (let index = 0; index < orderedStandings.length; index += 1) {
      orderedStandings[index].points = Math.floor(maxPoints);
      const next = orderedStandings[index + 1];
      if (!next) continue;
      if (
        Number(orderedStandings[index].score.percentage) >
        Number(next.score.percentage)
      ) {
        if (tieCount > 0) {
          maxPoints -= tieCount;
          tieCount = 0;
        }
        maxPoints -= 1;
      } else {
        tieCount += 1;
      }
    }
  }
}
