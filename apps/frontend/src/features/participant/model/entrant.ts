import type { EntrantDto, PlayerRefDto } from "@tournament-manager/contracts";

/**
 * The player an entrant stands for, when it stands for one.
 *
 * An entrant can be a team or a slot waiting to be filled by advancement, so
 * the answer is nullable and every caller has to say what it does with nothing.
 */
export function entrantPlayer(entrant: EntrantDto): PlayerRefDto | null {
  if (entrant.type !== "player") return null;
  return entrant.participants?.[0]?.player ?? null;
}

export function entrantPlayers(entrants: EntrantDto[] = []): PlayerRefDto[] {
  return entrants.map(entrantPlayer).filter((player): player is PlayerRefDto => Boolean(player));
}
