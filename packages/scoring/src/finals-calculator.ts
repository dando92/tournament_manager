import type { ScoringStanding } from './scoring-standing';
import type { ScoringSystem } from './scoring-system';

export class FinalsCalculator implements ScoringSystem {
  getName(): 'EurocupFinalsScoringSystem' {
    return 'EurocupFinalsScoringSystem';
  }

  getDescription(): string {
    return 'First to n';
  }

  recalc(standings: ScoringStanding[]): void {
    const orderedStandings = standings
      .sort(
        (left, right) =>
          Number(right.score.percentage) - Number(left.score.percentage),
      )
      .sort((left, right) => (right.score.isFailed ? 0 : 1));
    orderedStandings[0].points = 1;
    orderedStandings[1].points = 0;
  }
}
