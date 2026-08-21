import { useCallback, useEffect, useState } from "react";
import {
  clearManualScoring,
  getManualScoring,
  saveManualScoring,
} from "@/features/match/services/manualScoring";

/**
 * The hand-scoring draft for one match, kept in step with localStorage.
 *
 * Every change writes through immediately rather than on unmount: the point of
 * persisting is surviving a closed tab, and a tab that closes does not always
 * run cleanup.
 */
export function useManualScoring(matchId: number) {
  const [enabled, setEnabledState] = useState(false);
  const [points, setPointsState] = useState<Record<number, number>>({});

  useEffect(() => {
    const stored = getManualScoring(matchId);
    setEnabledState(stored.enabled);
    setPointsState(stored.points);
  }, [matchId]);

  const setEnabled = useCallback(
    (next: boolean) => {
      setEnabledState(next);
      setPointsState((current) => {
        const nextPoints = next ? current : {};
        saveManualScoring(matchId, { enabled: next, points: nextPoints });
        return nextPoints;
      });
    },
    [matchId],
  );

  const setPoints = useCallback(
    (playerId: number, value: number) => {
      setPointsState((current) => {
        const next = { ...current, [playerId]: value };
        saveManualScoring(matchId, { enabled: true, points: next });
        return next;
      });
    },
    [matchId],
  );

  /** Called once the server holds the result, so the draft has nothing left to say. */
  const clear = useCallback(() => {
    setEnabledState(false);
    setPointsState({});
    clearManualScoring(matchId);
  }, [matchId]);

  return { enabled, points, setEnabled, setPoints, clear };
}
