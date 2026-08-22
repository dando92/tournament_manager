import type {
    EntrantStatus,
    EntrantType,
    ParticipantRole,
    ParticipantStatus,
} from './vocabulary';

/**
 * The three shapes every projection of a competitor shares.
 *
 * A match, a division summary, a pool and the tournament overview all describe
 * the same entrant, and each used to describe it in its own DTO with its own
 * mapping code. They are one shape here, and the API maps them in one place.
 */

/** A player as somebody a row belongs to: enough to name them, nothing more. */
export type PlayerRefDto = {
    id: number;
    playerName: string;
};

export type ParticipantDto = {
    id: number;
    roles: ParticipantRole[];
    status: ParticipantStatus;
    player: PlayerRefDto;
};

export type EntrantDto = {
    id: number;
    name: string;
    type: EntrantType;
    status: EntrantStatus;
    participants: ParticipantDto[];
};

/** A song as a round refers to it. The song catalogue describes it in full. */
export type SongRefDto = {
    id: number;
    title: string;
};
