import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Song, Tournament } from '@tournament-manager/persistence';

/** What a song is, apart from the pool it is added to. */
export type SongInput = {
    title: string;
    artist?: string;
    group: string;
    difficulty: number;
    tournamentId?: number;
};

/**
 * Writing the song catalogue.
 *
 * A song is not an aggregate: nothing about it is decided anywhere else, and
 * nothing else is decided by it. What it needs is a place to be written from,
 * so the store is the only thing here that holds a repository, and the reads
 * that decide a roll or resolve a lobby title are `SongQueries`.
 */
@Injectable()
export class SongStore {
    constructor(
        @InjectRepository(Song)
        private readonly songs: Repository<Song>,
        @InjectRepository(Tournament)
        private readonly tournaments: Repository<Tournament>,
    ) {}

    /**
     * The tournament whose pool a song joins.
     *
     * It is loaded rather than referenced by id so that a tournament that does
     * not exist answers `404` instead of failing on a foreign key.
     */
    async loadTournament(tournamentId: number): Promise<Tournament> {
        const tournament = await this.tournaments.findOneBy({ id: tournamentId });
        if (!tournament) throw new NotFoundException(`Tournament ${tournamentId} not found`);

        return tournament;
    }

    async add(input: SongInput, tournament: Tournament | null): Promise<Song> {
        const song = this.songs.create({
            title: input.title,
            artist: input.artist,
            group: input.group,
            difficulty: input.difficulty,
        });
        song.tournament = tournament;

        return await this.songs.save(song);
    }

    async remove(songId: number): Promise<void> {
        await this.songs.delete(songId);
    }
}
