import { Injectable } from '@nestjs/common';
import { SongRollSlotDto } from '@tournament-manager/contracts';

import { SongQueries } from '@tournament/catalog/song.queries';

/**
 * What a roll is asked for.
 *
 * The pool is the tournament's, reached through the division, and which
 * division that is comes from the match or from the screen the draw was asked
 * on — never from a client stating a tournament it might not belong to. See
 * FQ-018.
 */
export type SongRollRequest = {
    tournamentId: number;
    divisionId: number;
    group: string | null;
    levels: number[];
    /** Offers songs the division has already played. Off is the tournament rule. */
    allowPlayed?: boolean;
    /** Songs the caller already holds: the other slots of a draw it is re-rolling one of. */
    excludeSongIds?: number[];
    /** The match the roll is for, whose songs no round of it may repeat. */
    matchId?: number | null;
};

/**
 * The levels a roll asks for, as somebody writes them.
 *
 * `9,9,10,10`, `9 9 10 10` and `9-9-10-10` say the same thing: four songs, two
 * of each level. Anything between the numbers separates them, so the parser
 * never has to be told which separator a caller chose.
 */
export function parseLevels(levels: string): number[] {
    return levels
        .split(/[^0-9]+/)
        .filter((part) => part.length > 0)
        .map((part) => parseInt(part, 10));
}

/**
 * Picking the songs a generated round is played on.
 *
 * A song already played somewhere in the division is out, whatever pool or
 * match it was played in, unless the draw explicitly asks for those too. That
 * set used to be collected by loading the whole division — its phases, its
 * pools, every match, every round and every song of every round — once per
 * level rolled, and then by loading the tournament's songs as entities to
 * subtract it from. It is one query, and it is asked once however many levels
 * are rolled.
 *
 * The roller is neither a commands class nor a query: it answers *which song*,
 * the way the match store answers which match a round belongs to. It decides
 * nothing about the round it is rolled for, and writes nothing — which is what
 * lets the same call answer a draw shown on screen and the write that follows
 * it.
 */
@Injectable()
export class SongRoller {
    constructor(private readonly songs: SongQueries) {}

    /**
     * One slot per level asked for, in the order they were asked for.
     *
     * A level nothing is available for answers with an empty slot rather than
     * an arbitrary song: the caller is told the pool had nothing to give. A
     * song picked for one level is not offered again for the next — asking for
     * `5,5` used to be able to name the same song twice, which the database
     * then refused as a repeated song in one match — and neither is a song the
     * caller says it is already holding.
     */
    async roll(request: SongRollRequest): Promise<SongRollSlotDto[]> {
        if (request.levels.length === 0) {
            return [];
        }

        const available = await this.songs.rollable(request.tournamentId, request.divisionId, request.group, {
            allowPlayed: request.allowPlayed,
            matchId: request.matchId,
        });
        const taken = new Set(request.excludeSongIds ?? []);

        return request.levels.map((level) => {
            const song = this.anyOf(available.filter((candidate) => candidate.difficulty === level && !taken.has(candidate.id)));
            if (song) {
                taken.add(song.id);
            }

            return { level, song };
        });
    }

    private anyOf<T>(candidates: T[]): T | null {
        if (candidates.length === 0) {
            return null;
        }

        return candidates[Math.floor(Math.random() * candidates.length)];
    }
}
