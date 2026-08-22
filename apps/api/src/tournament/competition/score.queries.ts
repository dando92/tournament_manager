import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Score } from '@tournament-manager/persistence';
import { ScoreDto } from '@tournament-manager/contracts';

/**
 * What a player has already run on a song.
 *
 * Its one caller is the standing dialog, which offers those runs instead of
 * asking for a percentage that has been entered before. It knows the song and
 * the player, so the projection carries neither; the previous read loaded both
 * relations and the caller discarded them.
 */
@Injectable()
export class ScoreQueries {
    constructor(
        @InjectRepository(Score)
        private readonly scoreRepository: Repository<Score>,
    ) {}

    /** Newest first, which is the order the dialog offers them in. */
    async history(songId: number, playerId: number): Promise<ScoreDto[]> {
        const scores = await this.scoreRepository.find({
            where: { song: { id: songId }, player: { id: playerId } },
            select: { id: true, percentage: true, isFailed: true },
            order: { id: 'DESC' },
        });

        return scores.map((score) => ({
            id: score.id,
            percentage: score.percentage,
            isFailed: score.isFailed,
        }));
    }
}
