import { isEliminationBracket, isRoundRobinBracket } from "@/features/division/model/bracketType";

/** How the matches of a pool are laid out. This is a device preference, not domain data. */
export type PoolViewMode = "raw" | "roundRobin" | "bracket";

const STORAGE_KEY = "pool_view_modes";

/** Views the bracket type allows. Raw is always one of them. */
export function availablePoolViewModes(bracketType: string | null | undefined): PoolViewMode[] {
  if (isRoundRobinBracket(bracketType)) return ["raw", "roundRobin"];
  if (isEliminationBracket(bracketType)) return ["raw", "bracket"];
  return ["raw"];
}

/** The view a pool uses until the user picks another one on this device. */
export function defaultPoolViewMode(bracketType: string | null | undefined): PoolViewMode {
  if (isRoundRobinBracket(bracketType)) return "roundRobin";
  if (isEliminationBracket(bracketType)) return "bracket";
  return "raw";
}

/** The stored choice while the bracket type still allows it, the default otherwise. */
export function readPoolViewMode(phaseGroupId: number, bracketType: string | null | undefined): PoolViewMode {
  const stored = readStoredModes()[String(phaseGroupId)];
  const available = availablePoolViewModes(bracketType);
  return available.includes(stored as PoolViewMode) ? (stored as PoolViewMode) : defaultPoolViewMode(bracketType);
}

/** Stores the choice, or drops the entry when it is the default the pool would use anyway. */
export function writePoolViewMode(
  phaseGroupId: number,
  bracketType: string | null | undefined,
  mode: PoolViewMode,
): void {
  const modes = readStoredModes();
  if (mode === defaultPoolViewMode(bracketType)) {
    delete modes[String(phaseGroupId)];
  } else {
    modes[String(phaseGroupId)] = mode;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(modes));
  } catch {
    /* Storage can be unavailable or full; the choice then lasts for this page only. */
  }
}

function readStoredModes(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}
