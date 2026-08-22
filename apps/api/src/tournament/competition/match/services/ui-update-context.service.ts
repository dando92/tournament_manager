import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Division, Phase, PhaseGroup } from '@tournament-manager/persistence';

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

/**
 * Where a division, a phase or a pool sits, for the events that name one.
 *
 * The match writes no longer come here: their store loads a graph that reaches
 * the tournament, so they publish an address they already hold. What is left
 * serves the aggregates that have not been given a store yet, and goes with the
 * last of them.
 */
@Injectable()
export class UiUpdateContextService {
    constructor(
        @InjectRepository(Division)
        private readonly divisionRepository: Repository<Division>,
        @InjectRepository(Phase)
        private readonly phaseRepository: Repository<Phase>,
        @InjectRepository(PhaseGroup)
        private readonly phaseGroupRepository: Repository<PhaseGroup>,
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
}
