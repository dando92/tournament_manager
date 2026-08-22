import type { EntrantDto, PlayerRefDto } from "@tournament-manager/contracts";

export type {
  EntrantStatus,
  EntrantType,
  ParticipantDto as Participant,
  ParticipantRole,
  ParticipantStatus,
} from "@tournament-manager/contracts";
export type { EntrantDto as Entrant };

export function entrantPlayer(entrant: EntrantDto): PlayerRefDto | null {
  if (entrant.type !== "player") return null;
  return entrant.participants?.[0]?.player ?? null;
}

export function entrantPlayers(entrants: EntrantDto[] = []): PlayerRefDto[] {
  return entrants.map(entrantPlayer).filter((player): player is PlayerRefDto => Boolean(player));
}
