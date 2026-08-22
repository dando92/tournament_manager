import assert from 'node:assert/strict';
import test from 'node:test';
import { staleAfterUpdate } from '../../src/features/tournament/model/staleAfterUpdate.ts';
import { matchKeys } from '../../src/features/match/api/match.keys.ts';
import { divisionKeys } from '../../src/features/division/api/division.keys.ts';
import { tournamentKeys } from '../../src/features/tournament/api/tournament.keys.ts';

const address = { tournamentId: 1, divisionId: 2, phaseId: 3, phaseGroupId: 4, matchId: 5 };

test('a match event stales the two lists that hold that match, and nothing else', () => {
  assert.deepEqual(staleAfterUpdate({ event: 'MatchUpdate', data: address }), [
    matchKeys.byPhaseGroup(4),
    matchKeys.byDivision(2),
  ]);
});

test('a pool event stales the tree as well, because the counts it draws moved', () => {
  assert.deepEqual(staleAfterUpdate({ event: 'PhaseGroupUpdate', data: address }), [
    tournamentKeys.overview(1),
    divisionKeys.summary(2),
    matchKeys.byPhaseGroup(4),
    matchKeys.byDivision(2),
  ]);
});

test('a division event stales its roster, which its seeding writes', () => {
  assert.deepEqual(staleAfterUpdate({ event: 'DivisionUpdate', data: address }), [
    tournamentKeys.overview(1),
    divisionKeys.summary(2),
    divisionKeys.entrants(2),
  ]);
});

test('a phase event stales the two projections of the tree it appears in', () => {
  assert.deepEqual(staleAfterUpdate({ event: 'PhaseUpdate', data: address }), [
    tournamentKeys.overview(1),
    divisionKeys.summary(2),
  ]);
});

test('a tournament event stales the tree alone', () => {
  assert.deepEqual(staleAfterUpdate({ event: 'TournamentUpdate', data: address }), [
    tournamentKeys.overview(1),
  ]);
});

test('a warning is a message to a person, so nothing goes stale', () => {
  assert.deepEqual(staleAfterUpdate({ event: 'UiWarning', data: { tournamentId: 1, message: 'Careful' } }), []);
});
