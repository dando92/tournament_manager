import assert from 'node:assert/strict';
import test from 'node:test';
import { getTournamentHeaderSubtitle } from '../../src/features/tournament/components/header/tournamentHeaderSubtitle.ts';

test('maps tournament routes to stable page subtitles', () => {
  assert.equal(
    getTournamentHeaderSubtitle('/tournament/7/participants', 7),
    'Participants',
  );
  assert.equal(
    getTournamentHeaderSubtitle('/tournament/7/unknown', 7),
    'Tournament Workspace',
  );
});
