import { Injectable } from '@nestjs/common';

import { SongImportOutcome, SongInput, SongStore } from '@tournament/catalog/song.store';
import { UiUpdatePublisher } from '@tournament/shared/ui-update.publisher';

/**
 * Adding a song to a pool and taking one out.
 *
 * A catalogue write announces the tournament whose song query changed. The
 * song pool does not move any other tournament projection, so it has its own
 * narrow invalidation rather than pretending the tournament itself changed.
 */
@Injectable()
export class SongCommands {
    constructor(
        private readonly store: SongStore,
        private readonly publisher: UiUpdatePublisher,
    ) {}

    /** Answers with the new song id: the importer counts what it added. */
    async create(input: SongInput): Promise<number> {
        const tournament = input.tournamentId ? await this.store.loadTournament(input.tournamentId) : null;
        const song = await this.store.add(input, tournament);
        await this.publisher.emitSongsUpdate(tournament?.id);

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

        const outcome = await this.store.import(songs, tournament);
        if (outcome.imported > 0) await this.publisher.emitSongsUpdate(tournamentId);

        return outcome;
    }

    async delete(songId: number): Promise<void> {
        await this.publisher.emitSongsUpdate(await this.store.remove(songId));
    }
}
