import { useState } from "react";
import { PoolViewMode, readPoolViewMode, writePoolViewMode } from "@/features/division/services/poolViewMode";
import { PhaseGroup } from "@/features/division/types/Phase";

/**
 * Device-local layout preference for one pool. Callers mount this per selected pool,
 * so the stored choice is read once when that pool comes into view.
 */
export function usePoolViewMode(phaseGroup: PhaseGroup): [PoolViewMode, (mode: PoolViewMode) => void] {
  const [mode, setMode] = useState<PoolViewMode>(() => readPoolViewMode(phaseGroup.id, phaseGroup.bracketType));

  const changeMode = (next: PoolViewMode) => {
    setMode(next);
    writePoolViewMode(phaseGroup.id, phaseGroup.bracketType, next);
  };

  return [mode, changeMode];
}
