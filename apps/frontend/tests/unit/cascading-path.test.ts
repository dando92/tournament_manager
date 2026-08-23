import assert from 'node:assert/strict';
import test from 'node:test';
import {
  describePath,
  isCompletePath,
  resolvePath,
  samePath,
  selectAtLevel,
} from '../../src/shared/components/ui/cascadingPath.ts';
import type { PathLevel } from '../../src/shared/components/ui/cascadingPath.ts';
import {
  isCompleteMatchPath,
  matchPathFromValue,
  matchPathLevels,
  matchPathValue,
} from '../../src/features/match/model/matchPath.ts';
import type { TournamentDivisionOption } from '../../src/features/tournament/model/types.ts';

/** A hierarchy with a branch that forks and one that does not. */
const tree: Record<string, Record<string, string[]>> = {
  a: { 'a-1': ['a-1-x', 'a-1-y'], 'a-2': ['a-2-x'] },
  b: { 'b-1': ['b-1-x'] },
};

const levels: PathLevel<string>[] = [
  {
    key: 'division',
    label: 'Division',
    getOptions: () => Object.keys(tree).map((value) => ({ value, label: value })),
  },
  {
    key: 'phase',
    label: 'Phase',
    getOptions: ([division]) =>
      Object.keys(tree[division as string] ?? {}).map((value) => ({ value, label: value })),
  },
  {
    key: 'pool',
    label: 'Pool',
    getOptions: ([division, phase]) =>
      (tree[division as string]?.[phase as string] ?? []).map((value) => ({ value, label: value })),
  },
];

test('keeps a complete path as it is', () => {
  assert.deepEqual(resolvePath(levels, ['a', 'a-1', 'a-1-x']), ['a', 'a-1', 'a-1-x']);
});

test('leaves the levels below an unchosen one empty', () => {
  assert.deepEqual(resolvePath(levels, ['a', null, null]), ['a', null, null]);
  assert.deepEqual(resolvePath(levels, [null, null, null]), [null, null, null]);
});

test('drops a choice its parent no longer allows', () => {
  assert.deepEqual(resolvePath(levels, ['a', 'b-1', 'b-1-x']), ['a', null, null]);
});

test('settles a level that offers a single option, and follows the chain down', () => {
  assert.deepEqual(resolvePath(levels, ['b', null, null]), ['b', 'b-1', 'b-1-x']);
  assert.deepEqual(resolvePath(levels, ['a', 'a-2', null]), ['a', 'a-2', 'a-2-x']);
});

test('a level is usable only once its ancestors are settled', () => {
  const views = describePath(levels, ['a', null, null]);
  assert.deepEqual(
    views.map((view) => view.enabled),
    [true, true, false],
  );
  assert.deepEqual(
    views.map((view) => view.selected?.value ?? null),
    ['a', null, null],
  );
  assert.deepEqual(views[1].options.map((option) => option.value), ['a-1', 'a-2']);
});

test('a level with nothing to offer cannot be used', () => {
  const empty: PathLevel<string>[] = [levels[0], { ...levels[1], getOptions: () => [] }];
  assert.equal(describePath(empty, ['a', null])[1].enabled, false);
});

test('choosing a level clears what was chosen below it', () => {
  assert.deepEqual(selectAtLevel(levels, ['a', 'a-1', 'a-1-x'], 0, 'b'), ['b', 'b-1', 'b-1-x']);
  assert.deepEqual(selectAtLevel(levels, ['a', 'a-1', 'a-1-y'], 1, 'a-1'), ['a', 'a-1', null]);
});

test('reads completeness off the path', () => {
  assert.equal(isCompletePath(['a', 'a-1', 'a-1-x']), true);
  assert.equal(isCompletePath(['a', 'a-1', null]), false);
  assert.equal(samePath(['a', null], ['a', null]), true);
  assert.equal(samePath(['a', null], ['a', 'a-1']), false);
});

/* The match hierarchy is the same rules over the tournament structure the tree
   already holds, so what is checked here is the reading of it. */

const divisions = [
  {
    id: 1,
    name: 'Open',
    phases: [
      { id: 10, name: 'Qualifiers', matchCount: 0, phaseGroups: [{ id: 100, name: 'Pool A', displayIdentifier: 'A' }] },
      { id: 11, name: 'Bracket', matchCount: 0, phaseGroups: [] },
    ],
  },
  { id: 2, name: 'Rookie', phases: [] },
] as unknown as TournamentDivisionOption[];

test('offers the phases of the chosen division and the pools of the chosen phase', () => {
  const matchLevels = matchPathLevels(divisions);
  const views = describePath(matchLevels, [1, 10, null]);

  assert.deepEqual(views[1].options.map((option) => option.label), ['Qualifiers', 'Bracket']);
  assert.deepEqual(views[2].options.map((option) => option.label), ['A']);
  assert.equal(views[2].selected?.value, 100);
});

test('a division without phases leaves the rest of the path empty', () => {
  assert.deepEqual(resolvePath(matchPathLevels(divisions), [2, null, null]), [2, null, null]);
});

test('a match path is complete only when it reaches a pool', () => {
  const path = matchPathFromValue(resolvePath(matchPathLevels(divisions), [1, 10, null]));
  assert.deepEqual(path, { divisionId: 1, phaseId: 10, phaseGroupId: 100 });
  assert.equal(isCompleteMatchPath(path), true);
  assert.equal(isCompleteMatchPath({ divisionId: 1, phaseId: 11, phaseGroupId: null }), false);
  assert.deepEqual(matchPathValue(path), [1, 10, 100]);
});
