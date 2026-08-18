export interface RecentTournament {
  id: number;
  name: string;
  logo?: string;
}

const STORAGE_KEY = "recent_tournaments";
const MAX_RECENT = 5;

export function getRecentTournaments(): RecentTournament[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentTournament[];
  } catch {
    return [];
  }
}

/** Add or move tournament to front of the list. Trims to MAX_RECENT. */
export function addRecentTournament(tournament: RecentTournament): void {
  const recent = getRecentTournaments().filter((t) => t.id !== tournament.id);
  recent.unshift(tournament);
  if (recent.length > MAX_RECENT) recent.pop();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recent));
}

/** Returns the most recently selected tournament (first in list). */
export function getSelectedTournament(): RecentTournament | null {
  const recent = getRecentTournaments();
  return recent.length > 0 ? recent[0] : null;
}

/** Move an existing recent tournament to the front (make it selected). */
export function selectRecentTournament(id: number): void {
  const recent = getRecentTournaments();
  const found = recent.find((t) => t.id === id);
  if (!found) return;
  const reordered = [found, ...recent.filter((t) => t.id !== id)];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reordered));
}
