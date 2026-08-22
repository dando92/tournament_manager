import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Player, Round, Score, Standing } from '@tournament-manager/persistence';

/**
 * Persistence for the points of one player in one round.
 *
 * A standing is addressed by `(roundId, playerId)`, which the database now
 * enforces as unique, so writing one is an upsert rather than a create followed
 * by a search for duplicates. The score is optional: a hand-scored round states
 * its points with nothing played behind them.
 */
@Injectable()
export class StandingService {
    constructor(
        @InjectRepository(Standing)
        private readonly standingRepo: Repository<Standing>,
        @InjectRepository(Round)
        private readonly roundRepo: Repository<Round>,
        @InjectRepository(Player)
        private readonly playerRepo: Repository<Player>,
    ) {}

    async findOne(roundId: number, playerId: number): Promise<Standing | null> {
        return this.standingRepo.findOne({
            where: { round: { id: roundId }, player: { id: playerId } },
            relations: { score: true, player: true },
        });
    }

    async upsert(
        roundId: number,
        playerId: number,
        values: { score?: Score | null; points: number },
    ): Promise<Standing> {
        const round = await this.roundRepo.findOneBy({ id: roundId });
        if (!round) throw new NotFoundException(`Round with id ${roundId} not found. Standing write failed`);

        const player = await this.playerRepo.findOneBy({ id: playerId });
        if (!player) throw new NotFoundException(`Player with id ${playerId} not found. Standing write failed`);

        const standing = (await this.findOne(roundId, playerId)) ?? new Standing();
        standing.round = round;
        standing.player = player;
        standing.points = values.points;
        if (values.score !== undefined) standing.score = values.score;

        return this.standingRepo.save(standing);
    }

    /** Writes back the points a scoring system just recalculated, and nothing else. */
    async savePoints(standings: Standing[]): Promise<void> {
        if (standings.length === 0) return;
        await this.standingRepo.save(standings.map((standing) => ({ id: standing.id, points: standing.points })));
    }

    async delete(id: number): Promise<void> {
        await this.standingRepo.delete(id);
    }
}
