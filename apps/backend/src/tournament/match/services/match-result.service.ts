import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Match, MatchResult } from '@persistence/entities';
import { Repository } from 'typeorm';

@Injectable()
export class MatchResultService {
    constructor(
        @InjectRepository(MatchResult)
        private readonly matchResultRepository: Repository<MatchResult>,
        @InjectRepository(Match)
        private readonly matchRepository: Repository<Match>,
    ) {}

    async upsertForMatch(matchId: number, playerPoints: MatchResult['playerPoints']): Promise<MatchResult> {
        const match = await this.matchRepository.findOne({
            where: { id: matchId },
            relations: { matchResult: true },
        });
        if (!match) throw new NotFoundException(`Match with ID ${matchId} not found`);

        const existing = match.matchResult ?? null;
        const entity = existing ?? this.matchResultRepository.create({ match });
        entity.playerPoints = playerPoints;
        const saved = await this.matchResultRepository.save(entity);
        match.matchResult = saved;
        await this.matchRepository.save(match);
        return saved;
    }

    async deleteForMatch(matchId: number): Promise<void> {
        const match = await this.matchRepository.findOne({
            where: { id: matchId },
            relations: { matchResult: true },
        });
        if (!match?.matchResult) return;

        const matchResult = match.matchResult;
        match.matchResult = null;
        await this.matchRepository.save(match);
        await this.matchResultRepository.remove(matchResult);
    }
}
