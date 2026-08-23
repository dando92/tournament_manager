import { Injectable } from '@nestjs/common';

import { SongInput, SongStore } from '@tournament/catalog/song.store';

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

    async delete(songId: number): Promise<void> {
        await this.store.remove(songId);
    }
}
