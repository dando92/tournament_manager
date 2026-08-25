import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import type { Entrant, Player } from '../../src/features/participant/model/types.ts';
import {
  createItgmaniaProfilesArchive,
  itgmaniaArchiveFileName,
  playersForItgmaniaProfiles,
  sanitizeWindowsName,
} from '../../src/features/participant/model/itgmaniaProfiles.ts';

function entrant(id: number, status: Entrant['status'], players: Player[], type: Entrant['type'] = 'player'): Entrant {
  return {
    id,
    name: players.map((player) => player.playerName).join(' / '),
    type,
    status,
    participants: players.map((player, index) => ({
      id: id * 10 + index,
      roles: ['competitor'],
      status: status === 'withdrawn' ? 'withdrawn' : 'registered',
      player,
    })),
  };
}

test('players are collected tournament-wide once, including withdrawn and team entrants', () => {
  const ann = { id: 1, playerName: 'Ann' };
  const bob = { id: 2, playerName: 'Bob' };
  const players = playersForItgmaniaProfiles([
    entrant(1, 'active', [ann]),
    entrant(2, 'withdrawn', [bob]),
    entrant(3, 'dropped', [ann, bob], 'team'),
  ]);

  assert.deepEqual(players, [ann, bob]);
});

test('the archive contains one profile per player under LocalProfiles and preserves display names', async () => {
  const archive = await createItgmaniaProfilesArchive([
    { id: 1, playerName: 'Alice/Bob' },
    { id: 2, playerName: 'Alice\\Bob' },
    { id: 3, playerName: 'CON' },
  ]);
  const zip = await JSZip.loadAsync(await archive.arrayBuffer());

  assert.ok(zip.file('LocalProfiles/Alice_Bob/Editable.ini'));
  assert.ok(zip.file('LocalProfiles/Alice_Bob (2)/Editable.ini'));
  assert.ok(zip.file('LocalProfiles/_CON/Editable.ini'));
  assert.match(await zip.file('LocalProfiles/Alice_Bob/Editable.ini')!.async('string'), /\r\nDisplayName=Alice\/Bob\r\n/);
  assert.match(await zip.file('LocalProfiles/Alice_Bob (2)/Editable.ini')!.async('string'), /\r\nDisplayName=Alice\\Bob\r\n/);
});

test('only filesystem names are sanitized', () => {
  assert.equal(sanitizeWindowsName('Finals: 2026.', 'Tournament'), 'Finals_ 2026');
  assert.equal(itgmaniaArchiveFileName('Finals: 2026.'), 'Finals_ 2026.zip');
});

test('an empty export still contains the LocalProfiles directory', async () => {
  const archive = await createItgmaniaProfilesArchive([]);
  const zip = await JSZip.loadAsync(await archive.arrayBuffer());

  assert.ok(zip.files['LocalProfiles/']);
});
