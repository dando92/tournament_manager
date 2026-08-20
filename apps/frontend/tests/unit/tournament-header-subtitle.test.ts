import assert from 'node:assert/strict';
import test from 'node:test';
import { getTournamentHeaderSubtitle } from '../../src/features/tournament/components/header/tournamentHeaderSubtitle.ts';
import { apiUrl, realtimeUrl } from '../../src/shared/runtime-config.ts';

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

test('prefers runtime deployment configuration over build-time defaults', () => {
  globalThis.window = {
    __TOURNAMENT_MANAGER_CONFIG__: {
      apiUrl: 'https://api.example.test/',
      realtimeUrl: 'https://realtime.example.test/',
    },
  } as Window & typeof globalThis;

  assert.equal(apiUrl(), 'https://api.example.test/');
  assert.equal(realtimeUrl(), 'https://realtime.example.test/');
});
