import { Injectable, Inject } from '@nestjs/common';
import { Song } from '@tournament-manager/persistence';
import { SongQueries } from '@tournament/catalog/song.queries';
import { SongService } from '@tournament/catalog/song.service';

/**
 * Picking the songs a generated round is played on.
 *
 * A song already played somewhere in the division is out, whatever pool or
 * match it was played in. That set used to be collected by loading the whole
 * division — its phases, its pools, every match, every round and every song of
 * every round — once per level rolled; it is one query now.
 */
@Injectable()
export class SongRoller {
    constructor(
        @Inject()
        private readonly songQueries: SongQueries,
        @Inject()
        private readonly songService: SongService) { }

    async RollSongs(tournamentId: number, divisionId: number, group: string, levels: string): Promise<number[]> {
        if (!tournamentId || !divisionId) return [];

        const intLevels = levels.split(",").map(s => parseInt(s, 10));
        const pool = await this.songService.findByTournament(tournamentId);
        if (pool.length === 0) return [];

        const played = new Set(await this.songQueries.playedInDivision(divisionId));

        const songs: number[] = [];
        for (const level of intLevels) {
            const songId = this.RollSong(pool, played, group, level);

            if (songId != 0) {
                songs.push(songId);
            }
        }

        return songs;
    }

    private RollSong(songs: Song[], played: Set<number>, group: string | null, level: number): number {
        const availableSongs = this.GetAvailableSong(songs, played, level, group);

        if (availableSongs.length == 0)
            return 0;

        return this.GetRandomElement(availableSongs);
    }

    private GetAvailableSong(songs: Song[], played: Set<number>, level: number, group: string | null): number[] {
        return songs
            .filter(s => (group === null || (group !== null && s.group === group)) && s.difficulty === level)
            .map(s => s.id)
            .filter(songId => !played.has(songId));
    }

    private GetRandomElement<T>(array: T[]): T {
        const randomIndex = Math.floor(Math.random() * array.length);
        return array[randomIndex];
    }
}
