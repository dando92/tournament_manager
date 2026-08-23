import type { LegacyScoreMessage } from "../legacy/score-message";

/**
 * The one number this bridge exists to carry.
 *
 * ITGmania formats the dance-point percentage itself, with the cabinet's own
 * decimal places, and that string is the value the venue reads off the screen.
 * It is preferred over recomputing it so that what Tournament Manager stores is
 * what the player saw. The dance points are the fallback for a cabinet that
 * sent an empty or unreadable percentage.
 *
 * The legacy protocol has no EX score. Tournament Manager stores `exScore` as
 * the run's percentage, so this percentage is published there, which is
 * recorded as FQ-025 rather than presented as an EX score.
 */
export function legacyPercentage(message: LegacyScoreMessage): number {
  const formatted = Number.parseFloat(
    message.formattedScore.replace("%", "").trim(),
  );
  if (Number.isFinite(formatted)) return clamp(formatted);

  if (
    !Number.isFinite(message.possibleDancePoints) ||
    message.possibleDancePoints <= 0
  )
    return 0;
  return clamp((message.actualDancePoints / message.possibleDancePoints) * 100);
}

function clamp(percentage: number): number {
  return Math.max(0, Math.min(100, percentage));
}
