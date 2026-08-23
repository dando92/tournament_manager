import { Injectable } from '@nestjs/common';

import { SongQueries } from '@tournament/catalog/song.queries';

/** One candidate for a roll: what the pick is made on, and nothing else. */
type Rollable = { id: number; difficulty: number };

/**
 * Picking the songs a generated round is played on.
 *
 * A song already played somewhere in the division is out, whatever pool or
 * match it was played in. That set used to be collected by loading the whole
 * division — its phases, its pools, every match, every round and every song of
 * every round — once per level rolled, and then by loading the tournament's
 * songs as entities to subtract it from. It is one query, and it is asked once
 * however many levels are rolled.
 *
 * The roller is neither a commands class nor a query: it answers *which song*,
 * the way the match store answers which match a round belongs to. It decides
 * nothing about the round it is rolled for, and writes nothing.
 */
@Injectable()
export class SongRoller {
    constructor(private readonly songs: SongQueries) {}

    /**
     * One song per level asked for, from the pool of the tournament the
     * division belongs to.
     *
     * A level nothing is available for rolls no song rather than an arbitrary
     * one, which is what leaves the round out. A song picked for one level is
     * not offered again for the next: asking for `5,5` used to be able to name
     * the same song twice, which the database then refused as a repeated song
     * in one match.
     */
    async roll(tournamentId: number, divisionId: number, group: string | null, levels: string): Promise<number[]> {
        const wanted = levels.split(',').map((level) => parseInt(level, 10)).filter((level) => Number.isFinite(level));
        if (wanted.length === 0) return [];

        const available = await this.songs.rollable(tournamentId, divisionId, group ?? null);
        const picked: number[] = [];

        for (const level of wanted) {
            const candidates = available.filter((song) => song.difficulty === level && !picked.includes(song.id));
            const song = this.anyOf(candidates);
            if (song) picked.push(song.id);
        }

        return picked;
    }

    private anyOf(candidates: Rollable[]): Rollable | null {
        if (candidates.length === 0) return null;

        return candidates[Math.floor(Math.random() * candidates.length)];
    }
}
