export const SCORING_SYSTEM_TYPES = [
  'EurocupFinalsScoringSystem',
  'EurocupScoreCalculator',
] as const;

export type ScoringSystemType = (typeof SCORING_SYSTEM_TYPES)[number];

export function isScoringSystemType(value: string): value is ScoringSystemType {
  return SCORING_SYSTEM_TYPES.some((type) => type === value);
}
