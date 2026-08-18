import { Player } from "@/features/player/types/Player";

export type ParticipantRole = "competitor" | "spectator" | "owner" | "staff" | "unknown";
export type ParticipantStatus = "registered" | "checked_in" | "withdrawn" | "unknown";
export type EntrantType = "player" | "team";
export type EntrantStatus = "active" | "dropped" | "withdrawn" | "dq" | "unknown";

export interface Participant {
  id: number;
  roles: ParticipantRole[];
  status: ParticipantStatus;
  player: Player;
}

export interface Entrant {
  id: number;
  name: string;
  type: EntrantType;
  status: EntrantStatus;
  participants: Participant[];
}

export function entrantPlayer(entrant: Entrant): Player | null {
  if (entrant.type !== "player") return null;
  return entrant.participants?.[0]?.player ?? null;
}

export function entrantPlayers(entrants: Entrant[] = []): Player[] {
  return entrants.map(entrantPlayer).filter((player): player is Player => Boolean(player));
}
