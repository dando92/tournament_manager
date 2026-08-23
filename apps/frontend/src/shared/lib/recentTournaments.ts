/**
 * The tournaments the sidebar offers: the ones you pinned, then the ones you
 * visited recently.
 *
 * Both lists store a snapshot of the name and logo so the sidebar can draw
 * itself before any request completes. A snapshot goes stale when a tournament
 * is renamed, so `rememberTournament` refreshes every list it appears in, and
 * `forgetTournament` drops one that no longer exists.
 */

export interface RecentTournament {
  id: number;
  name: string;
  logo?: string;
}

export type SidebarTournament = RecentTournament & { pinned: boolean };

export type SidebarTournamentGroups = {
  pinned: SidebarTournament[];
  recent: SidebarTournament[];
};

const RECENT_KEY = "recent_tournaments";
const PINNED_KEY = "pinned_tournaments";
const MAX_RECENT = 8;

function read(key: string): RecentTournament[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as RecentTournament[]).filter((entry) => typeof entry?.id === "number") : [];
  } catch {
    return [];
  }
}

function write(key: string, entries: RecentTournament[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(entries));
  } catch {
    /* Storage can be unavailable; the lists simply do not persist. */
  }
}

export function getRecentTournaments(): RecentTournament[] {
  return read(RECENT_KEY);
}

export function getPinnedTournaments(): RecentTournament[] {
  return read(PINNED_KEY);
}

export function isPinned(id: number): boolean {
  return getPinnedTournaments().some((entry) => entry.id === id);
}

/**
 * Records a visit: moves the tournament to the front of the recents and
 * refreshes the name held by every list, so a rename shows up everywhere the
 * next time the tournament is opened.
 */
export function rememberTournament(tournament: RecentTournament): void {
  const recent = getRecentTournaments().filter((entry) => entry.id !== tournament.id);
  recent.unshift(tournament);
  write(RECENT_KEY, recent.slice(0, MAX_RECENT));

  const pinned = getPinnedTournaments();
  if (pinned.some((entry) => entry.id === tournament.id)) {
    write(PINNED_KEY, pinned.map((entry) => (entry.id === tournament.id ? { ...entry, ...tournament } : entry)));
  }
}

/** Drops a tournament from both lists — used when it is deleted or gone. */
export function forgetTournament(id: number): void {
  write(RECENT_KEY, getRecentTournaments().filter((entry) => entry.id !== id));
  write(PINNED_KEY, getPinnedTournaments().filter((entry) => entry.id !== id));
}

export function removeRecentTournament(id: number): void {
  write(RECENT_KEY, getRecentTournaments().filter((entry) => entry.id !== id));
}

export function pinTournament(tournament: RecentTournament): void {
  if (isPinned(tournament.id)) return;
  write(PINNED_KEY, [...getPinnedTournaments(), tournament]);
}

export function unpinTournament(id: number): void {
  write(PINNED_KEY, getPinnedTournaments().filter((entry) => entry.id !== id));
}

/** Returns the most recently visited tournament, for the bare `/tournament` route. */
export function getSelectedTournament(): RecentTournament | null {
  return getRecentTournaments()[0] ?? null;
}

/**
 * What the sidebar lists: pinned first, then recents that are not already
 * pinned, so a tournament never appears twice.
 */
export function getSidebarTournaments(): SidebarTournament[] {
  const pinned = getPinnedTournaments();
  const pinnedIds = new Set(pinned.map((entry) => entry.id));
  return [
    ...pinned.map((entry) => ({ ...entry, pinned: true })),
    ...getRecentTournaments()
      .filter((entry) => !pinnedIds.has(entry.id))
      .map((entry) => ({ ...entry, pinned: false })),
  ];
}

/** The two tree sections. Pinned entries are already absent from recents. */
export function groupSidebarTournaments(tournaments: SidebarTournament[]): SidebarTournamentGroups {
  return {
    pinned: tournaments.filter((tournament) => tournament.pinned),
    recent: tournaments.filter((tournament) => !tournament.pinned),
  };
}
