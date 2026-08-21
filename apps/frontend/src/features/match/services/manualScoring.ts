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

export type ManualScoringStore = Record<string, ManualScoring>;
type Store = ManualScoringStore;

/*
 * The parsed store is cached and only replaced when it actually changes.
 *
 * Subscribers compare snapshots by identity, so handing back a freshly parsed
 * object every read would look like an endless stream of changes. This is also
 * what keeps sixty list rows from parsing the same JSON sixty times a render.
 */
let cache: Store | null = null;

function read(): Store {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    cache = parsed && typeof parsed === "object" ? (parsed as Store) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function invalidate(): void {
  cache = null;
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

/*
 * The store is observable because two places read it: the card, where the
 * points are typed, and the match list, where the commit button now lives. A
 * list that could not see the draft would offer to commit a hand-scored match
 * as if it were empty.
 */
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeManualScoring(listener: () => void): () => void {
  listeners.add(listener);
  /* Another tab writing the same key counts as a change here too. */
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    invalidate();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function getManualScoringStore(): Store {
  return read();
}

export function getManualScoring(matchId: number): ManualScoring {
  return read()[String(matchId)] ?? EMPTY;
}

export function manualScoringOf(store: Store, matchId: number): ManualScoring {
  return store[String(matchId)] ?? EMPTY;
}

/** The points that count toward a result: none at all unless hand scoring is on. */
export function effectiveManualPoints(scoring: ManualScoring): Record<number, number> {
  return scoring.enabled ? scoring.points : {};
}

export function saveManualScoring(matchId: number, scoring: Omit<ManualScoring, "updatedAt">): void {
  const store = { ...read(), [String(matchId)]: { ...scoring, updatedAt: Date.now() } };
  write(store);
  invalidate();
  notify();
}

export function clearManualScoring(matchId: number): void {
  const store = { ...read() };
  delete store[String(matchId)];
  write(store);
  invalidate();
  notify();
}
