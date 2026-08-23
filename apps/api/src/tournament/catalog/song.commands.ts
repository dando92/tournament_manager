import { Injectable } from '@nestjs/common';

import { SongImportOutcome, SongInput, SongStore } from '@tournament/catalog/song.store';

/**
 * Adding a song to a pool and taking one out.
 *
 * A catalogue write announces nothing. Everything the interface draws from a
 * tournament — its tree, its pools, its matches — is unaffected by the pool of
 * songs behind it, and the one screen that shows the pool is the one that just
 * wrote to it. The page still holds its list in `useState` and re-reads what it
 * wrote, which is the frontend work phase 4 left behind; when it moves onto the
 * query cache, this is where the event it listens for is published.
 */
@Injectable()
export class SongCommands {
    constructor(private readonly store: SongStore) {}

    /** Answers with the new song id: the importer counts what it added. */
    async create(input: SongInput): Promise<number> {
        const tournament = input.tournamentId ? await this.store.loadTournament(input.tournamentId) : null;
        const song = await this.store.add(input, tournament);

        return song.id;
    }

    /**
     * A folder of simfiles read in the browser joins the pool.
     *
     * The importer used to be the create endpoint called once per row of a
     * JSON file, which left a pack half added whenever one row failed. It is
     * one write now, and the tournament is loaded first so an import for a
     * tournament that does not exist answers `404` before anything is written.
     */
    async import(tournamentId: number, songs: SongInput[]): Promise<SongImportOutcome> {
        const tournament = await this.store.loadTournament(tournamentId);

        return await this.store.import(songs, tournament);
    }

    async delete(songId: number): Promise<void> {
        await this.store.remove(songId);
    }
}
