import { Standing } from '@tournament-manager/persistence';

import { EurocupScoreCalculator, FinalsCalculator } from '@tournament-manager/scoring';

function standing(percentage: number, isFailed = false, points = 0): Standing {
  return {
    points,
    score: {
      percentage,
      isFailed,
    },
  } as Standing;
}

describe('EurocupScoreCalculator', () => {
  const calculator = new EurocupScoreCalculator();

  it('awards descending points based on percentage', () => {
    const standings = [standing(98), standing(100), standing(99)];

    calculator.recalc(standings);

    expect(standings.map((entry) => entry.points)).toEqual([1, 3, 2]);
  });

  it('awards equal points to tied players and skips the tied placement', () => {
    const standings = [standing(100), standing(90), standing(100)];

    calculator.recalc(standings);

    expect(standings.map((entry) => entry.points)).toEqual([3, 1, 3]);
  });

  it('leaves failed scores at zero while retaining their place in the points scale', () => {
    const standings = [standing(100, true), standing(99), standing(98)];

    calculator.recalc(standings);

    expect(standings.map((entry) => entry.points)).toEqual([0, 3, 2]);
  });
});

describe('FinalsCalculator', () => {
  const calculator = new FinalsCalculator();

  it('awards one point to the higher successful score', () => {
    const standings = [standing(98), standing(99)];

    calculator.recalc(standings);

    expect(standings.map((entry) => [entry.score.percentage, entry.points])).toEqual([
      [99, 1],
      [98, 0],
    ]);
  });

  it('currently awards one point to the higher percentage even when that score failed', () => {
    const standings = [standing(99, true), standing(90)];

    calculator.recalc(standings);

    expect(standings.map((entry) => [entry.score.percentage, entry.points])).toEqual([
      [99, 1],
      [90, 0],
    ]);
  });
});
