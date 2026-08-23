import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ChartDifficulty, Song, Tournament } from '@tournament-manager/persistence';

/** What a song is, apart from the pool it is added to. */
export type SongInput = {
    title: string;
    artist?: string;
    group: string;
    difficulty: number;
    chartDifficulty?: ChartDifficulty | null;
    tournamentId?: number;
};

/** What an import did: what it wrote, and what the pool already held. */
export type SongImportOutcome = {
    imported: number;
    skipped: number;
};

/**
 * What makes two rows the same chart.
 *
 * The key the ITGmania importer has always de-duplicated on: one song path,
 * one pack, one meter. The slot is deliberately not part of it — two rows that
 * agree on all three are the same chart written twice, whatever the pack
 * author called the second one.
 */
function identity(input: { title: string; group: string; difficulty: number }): string {
    return `${input.title}\u0000${input.group}\u0000${input.difficulty}`;
}

/** Saves in batches, so one import is not one insert statement per chart. */
function chunks<T>(rows: T[], size: number): T[][] {
    const batches: T[][] = [];
    for (let index = 0; index < rows.length; index += size) batches.push(rows.slice(index, index + size));

    return batches;
}

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
        @InjectDataSource()
        private readonly dataSource: DataSource,
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
            chartDifficulty: input.chartDifficulty ?? null,
        });
        song.tournament = tournament;

        return await this.songs.save(song);
    }

    /**
     * A folder of simfiles joins a pool in one write.
     *
     * The rows arrive already de-duplicated among themselves, and are checked
     * again here against each other and against the pool: an import repeated
     * on the same folder adds nothing rather than a second copy of everything.
     * The transaction is what makes a pack all-or-nothing, which is the whole
     * reason this is not the create endpoint called in a loop.
     */
    async import(inputs: SongInput[], tournament: Tournament): Promise<SongImportOutcome> {
        return await this.dataSource.transaction(async (manager) => {
            const songs = manager.getRepository(Song);
            const existing: Array<{ title: string; group: string; difficulty: number }> = await songs.find({
                select: { title: true, group: true, difficulty: true },
                where: { tournament: { id: tournament.id } },
            });
            const seen = new Set(existing.map(identity));

            const rows = inputs.filter((input) => {
                const key = identity(input);
                if (seen.has(key)) return false;

                seen.add(key);
                return true;
            });

            for (const chunk of chunks(rows, 500)) {
                await songs.save(
                    chunk.map((input) =>
                        songs.create({
                            title: input.title,
                            artist: input.artist,
                            group: input.group,
                            difficulty: input.difficulty,
                            chartDifficulty: input.chartDifficulty ?? null,
                            tournament,
                        }),
                    ),
                );
            }

            return { imported: rows.length, skipped: inputs.length - rows.length };
        });
    }

    async remove(songId: number): Promise<number | null> {
        const song = await this.songs.findOne({ where: { id: songId }, relations: { tournament: true } });
        if (!song) return null;

        const tournamentId = song.tournament?.id ?? null;
        await this.songs.remove(song);

        return tournamentId;
    }
}
