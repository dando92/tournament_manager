import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entrant, Match, PhaseGroup } from '@persistence/entities';
import { CreateMatchDto, UpdateMatchDto } from '@match/dtos/match.dto';
import { UiUpdateGateway } from '@match/gateways/ui-update.gateway';
import { AdvancementRuleService } from '@tournament/services/advancement-rule.service';

@Injectable()
export class MatchService {
    constructor(
        @InjectRepository(Match)
        private readonly matchRepository: Repository<Match>,
        @InjectRepository(PhaseGroup)
        private readonly phaseGroupRepository: Repository<PhaseGroup>,
        @InjectRepository(Entrant)
        private readonly entrantRepository: Repository<Entrant>,
        private readonly uiUpdateGateway: UiUpdateGateway,
        private readonly advancementRuleService: AdvancementRuleService,
    ) {}

    async create(dto: CreateMatchDto): Promise<Match> {
        const match = new Match();

        const phaseGroup = await this.phaseGroupRepository.findOne({
            where: { id: dto.phaseGroupId },
            relations: { phase: true },
        });
        if (!phaseGroup) throw new NotFoundException(`PhaseGroup with ID ${dto.phaseGroupId} not found`);
        match.phaseGroup = phaseGroup;

        match.entrants = [];

        if (dto.entrantIds !== undefined) {
            for (const entrantId of dto.entrantIds) {
                const entrant = await this.entrantRepository.findOne({
                    where: { id: entrantId },
                    relations: { participants: { player: true } },
                });
                if (!entrant) throw new NotFoundException(`Entrant with ID ${entrantId} not found`);
                match.entrants.push(entrant);
            }
        }

        match.scoringSystem = dto.scoringSystem;
        match.active = false;
        match.name = dto.name;
        if (dto.notes) {
            match.notes = dto.notes;
        }
        match.subtitle = dto.subtitle;

        const savedMatch = await this.matchRepository.save(match);
        await this.uiUpdateGateway.emitPhaseGroupUpdateByPhaseGroupId(phaseGroup.id);

        return savedMatch;
    }

    async getMatch(id: number): Promise<Match | null> {
        return await this.findOneForView(id);
    }

    async findActiveByTournamentForLobbyLookup(tournamentId: number): Promise<Match[]> {
        return await this.matchRepository.find({
            where: {
                active: true,
                phaseGroup: {
                    phase: {
                    division: {
                        tournament: {
                            id: tournamentId,
                        },
                    },
                    },
                },
            },
            relations: {
                entrants: { participants: { player: true } },
                rounds: {
                    song: true,
                    standings: {
                        score: {
                            player: true,
                            song: true,
                        },
                    },
                },
                matchResult: true,
            },
        });
    }

    async findByDivisionForView(divisionId: number): Promise<Match[]> {
        return this.matchRepository.find({
            where: {
                phaseGroup: {
                    phase: {
                    division: {
                        id: divisionId,
                    },
                    },
                },
            },
            relations: {
                phaseGroup: { phase: true },
                entrants: { participants: { player: true } },
                rounds: {
                    song: true,
                    standings: {
                        score: {
                            player: true,
                        },
                    },
                },
                matchResult: true,
            },
        });
    }

    async findByPhaseGroupForView(phaseGroupId: number): Promise<Match[]> {
        return this.matchRepository.find({
            where: {
                phaseGroup: {
                    id: phaseGroupId,
                },
            },
            relations: {
                phaseGroup: { phase: true },
                entrants: { participants: { player: true } },
                rounds: {
                    song: true,
                    standings: {
                        score: {
                            player: true,
                        },
                    },
                },
                matchResult: true,
            },
        });
    }

    async findOneForView(id: number): Promise<Match | null> {
        return await this.matchRepository.findOne({
            where: { id },
            relations: {
                entrants: { participants: { player: true } },
                phaseGroup: { phase: true },
                rounds: {
                    song: true,
                    standings: {
                        score: {
                            player: true,
                            song: true,
                        },
                    },
                    matchAssignments: true,
                },
                matchResult: true,
            },
        });
    }

    async findOneBasic(id: number): Promise<Match | null> {
        return await this.matchRepository.findOneBy({ id });
    }

    async update(id: number, dto: UpdateMatchDto): Promise<Match> {
        const match = await this.findOneBasic(id);
        if (!match) throw new Error(`Match with ID ${id} not found`);

        if (dto.phaseGroupId !== undefined) {
            const phaseGroup = await this.phaseGroupRepository.findOne({
                where: { id: dto.phaseGroupId },
                relations: { phase: true },
            });
            if (!phaseGroup) throw new NotFoundException(`PhaseGroup with ID ${dto.phaseGroupId} not found`);
            match.phaseGroup = phaseGroup;
            delete dto.phaseGroupId;
        }

        if (dto.entrantIds !== undefined) {
            const entrants = [];
            for (const entrantId of dto.entrantIds) {
                const entrant = await this.entrantRepository.findOne({
                    where: { id: entrantId },
                    relations: { participants: { player: true } },
                });
                if (!entrant) throw new NotFoundException(`Entrant with ID ${entrantId} not found`);
                entrants.push(entrant);
            }
            match.entrants = entrants;
            delete dto.entrantIds;
        }

        this.matchRepository.merge(match, dto);
        const updatedMatch = await this.matchRepository.save(match);
        await this.uiUpdateGateway.emitMatchUpdateByMatchId(updatedMatch.id);
        return updatedMatch;
    }

    async updateActive(id: number, active: boolean): Promise<Match> {
        const match = await this.findOneBasic(id);
        if (!match) throw new Error(`Match with ID ${id} not found`);

        match.active = active;
        const updatedMatch = await this.matchRepository.save(match);
        await this.uiUpdateGateway.emitMatchUpdateByMatchId(updatedMatch.id);
        return updatedMatch;
    }

    async delete(id: number): Promise<void> {
        const match = await this.findOneBasic(id);
        if (!match) return;
        const loaded = await this.matchRepository.findOne({
            where: { id },
            relations: { phaseGroup: { phase: true } },
        });
        const phaseGroupId = loaded?.phaseGroup?.id;

        await this.advancementRuleService.deleteInvolvingMatch(id);

        await this.matchRepository.remove(match);
        await this.uiUpdateGateway.emitPhaseGroupUpdateByPhaseGroupId(phaseGroupId);
    }
}
