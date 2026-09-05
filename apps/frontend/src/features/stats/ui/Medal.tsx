/**
 * The trophy the top three of a finished division wear.
 *
 * Decorative identity rather than state, which is why it uses the `medal-*`
 * scale and not the semantic palette. A shared band takes the medal of the place
 * it starts at and everybody in it gets one: two people at 3–4 are both bronze,
 * because the tournament never said which of them was third.
 */
const MEDAL_TONE = ["text-medal-gold", "text-medal-silver", "text-medal-bronze"];

function medalTone(placement: number): string | null {
  return MEDAL_TONE[placement - 1] ?? null;
}

export default function Medal({ placement, size = 15 }: { placement: number; size?: number }) {
  const tone = medalTone(placement);
  if (!tone) {
    return null;
  }

  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={tone} fill="currentColor" aria-hidden="true">
      <path d="M7 3h10v2h3.5a1 1 0 0 1 1 1v2a4.5 4.5 0 0 1-4.2 4.49A6 6 0 0 1 13 15.9V18h3.2a1 1 0 0 1 1 1v2H6.8v-2a1 1 0 0 1 1-1H11v-2.1a6 6 0 0 1-4.3-3.41A4.5 4.5 0 0 1 2.5 8V6a1 1 0 0 1 1-1H7V3Zm0 4H4.5v1a2.5 2.5 0 0 0 2.06 2.46A6 6 0 0 1 7 9V7Zm12.5 0H17v2c0 .5-.06.99-.17 1.46A2.5 2.5 0 0 0 19.5 8V7Z" />
    </svg>
  );
}
