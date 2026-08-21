import { useCallback, useSyncExternalStore } from "react";
import {
  clearManualScoring,
  getManualScoringStore,
  manualScoringOf,
  saveManualScoring,
  subscribeManualScoring,
  type ManualScoringStore,
} from "@/features/match/services/manualScoring";

/**
 * The hand-scoring drafts, kept in step with localStorage.
 *
 * Two places need them and they must agree: the card, where the points are
 * typed, and the list, where the commit button now sits. Subscribing rather
 * than each reading on its own is what stops the list from offering to commit a
 * match it thinks is empty.
 */

const getSnapshot = () => getManualScoringStore();

export function useManualScoringStore(): ManualScoringStore {
  return useSyncExternalStore(subscribeManualScoring, getSnapshot);
}

/** One match's draft, plus the writes that change it. */
export function useManualScoring(matchId: number) {
  const store = useSyncExternalStore(subscribeManualScoring, getSnapshot);
  const scoring = manualScoringOf(store, matchId);

  const setEnabled = useCallback(
    (next: boolean) => {
      saveManualScoring(matchId, { enabled: next, points: next ? manualScoringOf(getSnapshot(), matchId).points : {} });
    },
    [matchId],
  );

  const setPoints = useCallback(
    (playerId: number, value: number) => {
      const current = manualScoringOf(getSnapshot(), matchId);
      saveManualScoring(matchId, { enabled: true, points: { ...current.points, [playerId]: value } });
    },
    [matchId],
  );

  /** Called once the server holds the result, so the draft has nothing left to say. */
  const clear = useCallback(() => clearManualScoring(matchId), [matchId]);

  return { enabled: scoring.enabled, points: scoring.points, setEnabled, setPoints, clear };
}
