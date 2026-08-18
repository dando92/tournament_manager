export interface ScoringStanding {
  points: number;
  score: {
    percentage: number;
    isFailed: boolean;
  };
}

export interface ScoringSystem {
  getName(): string;
  getDescription(): string;
  recalc(standings: ScoringStanding[]): void;
}

export class EurocupScoreCalculator implements ScoringSystem {
  getName(): string {
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

export class FinalsCalculator implements ScoringSystem {
  getName(): string {
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

export class ScoringSystemProvider {
  private readonly systems: Map<string, ScoringSystem>;

  constructor() {
    const systems = [new EurocupScoreCalculator(), new FinalsCalculator()];
    this.systems = new Map(systems.map((system) => [system.getName(), system]));
  }

  getScoringSystem(name: string): ScoringSystem | undefined {
    return this.systems.get(name);
  }

  getAll(): string[] {
    return Array.from(this.systems.keys());
  }
}
