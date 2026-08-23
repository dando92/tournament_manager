import assert from 'node:assert/strict';
import test from 'node:test';

import { EurocupScoreCalculator, FinalsCalculator } from '../../dist/index.js';

/** A scoring system only ever ranks standings that have a score behind them. */
function standing(percentage, isFailed = false, points = 0) {
  return {
    points,
    score: {
      percentage,
      isFailed,
    },
  };
}

test('EurocupScoreCalculator awards descending points based on percentage', () => {
  const calculator = new EurocupScoreCalculator();

  const standings = [standing(98), standing(100), standing(99)];

  calculator.recalc(standings);

  assert.deepEqual(standings.map((entry) => entry.points), [1, 3, 2]);
});

test('EurocupScoreCalculator awards equal points to tied players and skips the tied placement', () => {
  const calculator = new EurocupScoreCalculator();
  const standings = [standing(100), standing(90), standing(100)];

  calculator.recalc(standings);

  assert.deepEqual(standings.map((entry) => entry.points), [3, 1, 3]);
});

test('EurocupScoreCalculator leaves failed scores at zero while retaining their place in the points scale', () => {
  const calculator = new EurocupScoreCalculator();
  const standings = [standing(100, true), standing(99), standing(98)];

  calculator.recalc(standings);

  assert.deepEqual(standings.map((entry) => entry.points), [0, 3, 2]);
});

test('FinalsCalculator awards one point to the higher successful score', () => {
  const calculator = new FinalsCalculator();
  const standings = [standing(98), standing(99)];

  calculator.recalc(standings);

  assert.deepEqual(standings.map((entry) => [entry.score.percentage, entry.points]), [
    [99, 1],
    [98, 0],
  ]);
});

test('FinalsCalculator currently awards one point to the higher percentage even when that score failed', () => {
  const calculator = new FinalsCalculator();
  const standings = [standing(99, true), standing(90)];

  calculator.recalc(standings);

  assert.deepEqual(standings.map((entry) => [entry.score.percentage, entry.points]), [
    [99, 1],
    [90, 0],
  ]);
});
