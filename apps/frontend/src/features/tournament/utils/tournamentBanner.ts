/**
 * Decorative banner gradients that give a tournament a recognisable identity
 * before it has a logo.
 *
 * These hues sit outside the semantic palette on purpose: they identify a
 * tournament, they never report a state. Nothing should read meaning into a
 * particular gradient, and no semantic rule applies to this list.
 */
const BANNER_GRADIENTS = [
  "from-red-700 to-red-900",
  "from-blue-700 to-blue-900",
  "from-purple-700 to-purple-900",
  "from-emerald-700 to-emerald-900",
  "from-orange-600 to-red-800",
  "from-cyan-700 to-blue-900",
];

export function getBannerGradient(tournamentId: number): string {
  return BANNER_GRADIENTS[tournamentId % BANNER_GRADIENTS.length];
}
