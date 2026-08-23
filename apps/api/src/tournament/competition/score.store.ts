import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Player, Score, Song } from '@tournament-manager/persistence';

/** One run: what somebody scored on one song. */
export type RunInput = {
    playerId: number;
    songId: number;
    percentage: number;
    isFailed: boolean;
};

/**
 * Writing down what was played.
 *
 * A score is evidence rather than a decision: it is what a cabinet reported, or
 * what somebody typed in its place, and it belongs to a player and a song
 * rather than to a match. The round that ends up pointing at one is the match's
 * business, which is why a run is recorded here whether or not any round was
 * waiting for it — a lobby played outside a tracked match still leaves the run
 * the standing dialog offers later.
 */
@Injectable()
export class ScoreStore {
    constructor(
        @InjectRepository(Score)
        private readonly scores: Repository<Score>,
    ) {}

    /** One insert for a whole lobby, in the order the runs were given. */
    async record(runs: RunInput[]): Promise<Score[]> {
        if (runs.length === 0) return [];

        return await this.scores.save(runs.map((run) => this.scores.create({
            player: { id: run.playerId } as Player,
            song: { id: run.songId } as Song,
            percentage: run.percentage,
            isFailed: run.isFailed,
        })));
    }
}
