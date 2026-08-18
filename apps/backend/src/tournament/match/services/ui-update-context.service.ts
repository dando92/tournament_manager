import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Division, Match, Phase, PhaseGroup } from '@persistence/entities';

type DivisionUpdatePayload = {
    tournamentId: number;
    divisionId: number;
};

type PhaseUpdatePayload = {
    tournamentId: number;
    divisionId: number;
    phaseId: number;
};

type PhaseGroupUpdatePayload = {
    tournamentId: number;
    divisionId: number;
    phaseId: number;
    phaseGroupId: number;
};

type MatchUpdatePayload = {
    tournamentId: number;
    divisionId: number;
    phaseId: number;
    phaseGroupId: number;
    matchId: number;
};

@Injectable()
export class UiUpdateContextService {
    constructor(
        @InjectRepository(Division)
        private readonly divisionRepository: Repository<Division>,
        @InjectRepository(Phase)
        private readonly phaseRepository: Repository<Phase>,
        @InjectRepository(PhaseGroup)
        private readonly phaseGroupRepository: Repository<PhaseGroup>,
        @InjectRepository(Match)
        private readonly matchRepository: Repository<Match>,
    ) {}

    async getDivisionUpdatePayload(divisionId: number): Promise<DivisionUpdatePayload | null> {
        const data = await this.divisionRepository
            .createQueryBuilder('division')
            .leftJoin('division.tournament', 'tournament')
            .select('tournament.id', 'tournamentId')
            .addSelect('division.id', 'divisionId')
            .where('division.id = :divisionId', { divisionId })
            .getRawOne<DivisionUpdatePayload>();

        if (!data?.tournamentId || !data?.divisionId) {
            return null;
        }

        return {
            tournamentId: Number(data.tournamentId),
            divisionId: Number(data.divisionId),
        };
    }

    async getPhaseUpdatePayload(phaseId: number): Promise<PhaseUpdatePayload | null> {
        const data = await this.phaseRepository
            .createQueryBuilder('phase')
            .leftJoin('phase.division', 'division')
            .leftJoin('division.tournament', 'tournament')
            .select('tournament.id', 'tournamentId')
            .addSelect('division.id', 'divisionId')
            .addSelect('phase.id', 'phaseId')
            .where('phase.id = :phaseId', { phaseId })
            .getRawOne<PhaseUpdatePayload>();

        if (!data?.tournamentId || !data?.divisionId || !data?.phaseId) {
            return null;
        }

        return {
            tournamentId: Number(data.tournamentId),
            divisionId: Number(data.divisionId),
            phaseId: Number(data.phaseId),
        };
    }

    async getPhaseGroupUpdatePayload(phaseGroupId: number): Promise<PhaseGroupUpdatePayload | null> {
        const data = await this.phaseGroupRepository
            .createQueryBuilder('phaseGroup')
            .leftJoin('phaseGroup.phase', 'phase')
            .leftJoin('phase.division', 'division')
            .leftJoin('division.tournament', 'tournament')
            .select('tournament.id', 'tournamentId')
            .addSelect('division.id', 'divisionId')
            .addSelect('phase.id', 'phaseId')
            .addSelect('phaseGroup.id', 'phaseGroupId')
            .where('phaseGroup.id = :phaseGroupId', { phaseGroupId })
            .getRawOne<PhaseGroupUpdatePayload>();

        if (!data?.tournamentId || !data?.divisionId || !data?.phaseId || !data?.phaseGroupId) {
            return null;
        }

        return {
            tournamentId: Number(data.tournamentId),
            divisionId: Number(data.divisionId),
            phaseId: Number(data.phaseId),
            phaseGroupId: Number(data.phaseGroupId),
        };
    }

    async getMatchUpdatePayload(matchId: number): Promise<MatchUpdatePayload | null> {
        const data = await this.matchRepository
            .createQueryBuilder('match')
            .leftJoin('match.phaseGroup', 'phaseGroup')
            .leftJoin('phaseGroup.phase', 'phase')
            .leftJoin('phase.division', 'division')
            .leftJoin('division.tournament', 'tournament')
            .select('tournament.id', 'tournamentId')
            .addSelect('division.id', 'divisionId')
            .addSelect('phase.id', 'phaseId')
            .addSelect('phaseGroup.id', 'phaseGroupId')
            .addSelect('match.id', 'matchId')
            .where('match.id = :matchId', { matchId })
            .getRawOne<MatchUpdatePayload>();

        if (!data?.tournamentId || !data?.divisionId || !data?.phaseId || !data?.phaseGroupId || !data?.matchId) {
            return null;
        }

        return {
            tournamentId: Number(data.tournamentId),
            divisionId: Number(data.divisionId),
            phaseId: Number(data.phaseId),
            phaseGroupId: Number(data.phaseGroupId),
            matchId: Number(data.matchId),
        };
    }
}
