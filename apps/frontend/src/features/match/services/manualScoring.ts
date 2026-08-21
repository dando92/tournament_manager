/**
 * Matches scored by hand, and the points typed into them so far.
 *
 * A match with no songs used to fall into hand-scoring silently, just by having
 * nothing in it. It is a deliberate choice now, and it is remembered: the points
 * are a draft that only reaches the server on commit, so without this they were
 * lost by closing a tab — which is a bad thing to discover halfway through a
 * pool.
 *
 * This is device state, not tournament state. Two people scoring the same match
 * by hand each hold their own draft until one of them commits, and the commit
 * is what makes it real.
 */

export type ManualScoring = {
  enabled: boolean;
  points: Record<number, number>;
  updatedAt: number;
};

const STORAGE_KEY = "match_manual_scoring";
const MAX_REMEMBERED_MATCHES = 50;

const EMPTY: ManualScoring = { enabled: false, points: {}, updatedAt: 0 };

type Store = Record<string, ManualScoring>;

function read(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

function write(store: Store): void {
  try {
    /* Drafts accumulate one per match forever otherwise. The oldest are the
       ones least likely to still matter. */
    const entries = Object.entries(store).sort(([, a], [, b]) => b.updatedAt - a.updatedAt);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries.slice(0, MAX_REMEMBERED_MATCHES))));
  } catch {
    /* Storage can be unavailable; hand scoring still works for this session. */
  }
}

export function getManualScoring(matchId: number): ManualScoring {
  return read()[String(matchId)] ?? EMPTY;
}

export function saveManualScoring(matchId: number, scoring: Omit<ManualScoring, "updatedAt">): void {
  const store = read();
  store[String(matchId)] = { ...scoring, updatedAt: Date.now() };
  write(store);
}

export function clearManualScoring(matchId: number): void {
  const store = read();
  delete store[String(matchId)];
  write(store);
}
