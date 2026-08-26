import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Score } from '@tournament-manager/persistence';
import { ScoreDto } from '@tournament-manager/contracts';

/**
 * What a player has already run on a song and can still assign.
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

    /** Newest first, excluding evidence already consumed by another standing. */
    async history(songId: number, playerId: number): Promise<ScoreDto[]> {
        const scores = await this.scoreRepository.createQueryBuilder('score')
            .select(['score.id', 'score.percentage', 'score.isFailed'])
            .where('score.songId = :songId', { songId })
            .andWhere('score.playerId = :playerId', { playerId })
            .andWhere('NOT EXISTS (SELECT 1 FROM "standing" standing WHERE standing."scoreId" = score.id)')
            .andWhere('NOT EXISTS (SELECT 1 FROM "match_tiebreak_standing" standing WHERE standing."scoreId" = score.id)')
            .orderBy('score.id', 'DESC')
            .getMany();

        return scores.map((score) => ({
            id: score.id,
            percentage: score.percentage,
            isFailed: score.isFailed,
        }));
    }
}
