import { Entrant, Participant, Player } from '@tournament-manager/persistence';
import { EntrantDto, ParticipantDto, PlayerRefDto } from '@tournament-manager/contracts';

/**
 * How a competitor is projected, once.
 *
 * A match, a division summary, a pool and the tournament overview all describe
 * the same entrant. Each used to carry its own copy of these three maps, and
 * the copies had drifted; the differences were accidental, and this is the
 * shape they agreed on.
 *
 * `MatchQueries` does not call these. It builds the same JSON in the database,
 * against the keys of the same DTOs, which is what keeps a list of matches to
 * one query.
 */

export function toPlayerRefDto(player: Player): PlayerRefDto {
    return {
        id: player.id,
        playerName: player.playerName,
        nationality: player.nationality ?? '',
    };
}

export function toParticipantDto(participant: Participant): ParticipantDto {
    return {
        id: participant.id,
        roles: participant.roles ?? [],
        status: participant.status,
        player: toPlayerRefDto(participant.player),
    };
}

export function toEntrantDto(entrant: Entrant): EntrantDto {
    return {
        id: entrant.id,
        name: entrant.name,
        type: entrant.type,
        status: entrant.status,
        participants: (entrant.participants ?? []).map(toParticipantDto),
    };
}
