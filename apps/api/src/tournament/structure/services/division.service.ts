import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Division, Entrant, Tournament } from '@tournament-manager/persistence';
import { CreateDivisionDto, UpdateDivisionDto } from '@tournament/dtos';
import { UiUpdatePublisher } from '@match/services/ui-update.publisher';

@Injectable()
export class DivisionService {
    constructor(
        @InjectRepository(Division)
        private readonly divisionRepository: Repository<Division>,
        @InjectRepository(Tournament)
        private readonly tournamentRepository: Repository<Tournament>,
        @InjectRepository(Entrant)
        private readonly entrantRepository: Repository<Entrant>,
        private readonly uiUpdateGateway: UiUpdatePublisher,
    ) {}

    async create(dto: CreateDivisionDto): Promise<Division> {
        const tournament = await this.tournamentRepository.findOneBy({ id: dto.tournamentId });
        if (!tournament) throw new NotFoundException(`Tournament ${dto.tournamentId} not found`);
        const division = new Division();
        division.name = dto.name;
        division.tournament = tournament;
        const savedDivision = await this.divisionRepository.save(division);
        await this.uiUpdateGateway.emitTournamentUpdate(dto.tournamentId);
        return savedDivision;
    }

    async findOneForBracketGeneration(id: number): Promise<Division | null> {
        return this.divisionRepository.findOne({
            where: { id },
            relations: {
                entrants: {
                    participants: {
                        player: true,
                    },
                },
                phases: {
                    phaseGroups: {
                        entrants: {
                            entrant: {
                                participants: {
                                    player: true,
                                },
                            },
                        },
                        matches: {
                            entrants: {
                                participants: {
                                    player: true,
                                },
                            },
                            rounds: {
                                song: true,
                            },
                        },
                    },
                },
            },
        });
    }

    async findEntrantsOnly(id: number): Promise<Division | null> {
        return this.divisionRepository.findOne({
            where: { id },
            relations: {
                tournament: true,
                entrants: {
                    participants: {
                        player: true,
                    },
                },
            },
        });
    }

    async findOneBasic(id: number): Promise<Division | null> {
        return this.divisionRepository.findOne({
            where: { id },
            relations: {
                tournament: true,
            },
        });
    }

    async update(id: number, dto: UpdateDivisionDto): Promise<Division> {
        const division = await this.findOneBasic(id);
        if (!division) throw new NotFoundException(`Division ${id} not found`);
        if (dto.tournamentId) {
            const tournament = await this.tournamentRepository.findOneBy({ id: dto.tournamentId });
            if (!tournament) throw new NotFoundException(`Tournament ${dto.tournamentId} not found`);
            division.tournament = tournament;
            delete dto.tournamentId;
        }
        this.divisionRepository.merge(division, dto);
        const saved = await this.divisionRepository.save(division);
        /* A renamed division is a changed tree. Nothing was published here, so
           the name only moved for whoever pressed the button. */
        await this.uiUpdateGateway.emitDivisionUpdateByDivisionId(id);

        return saved;
    }

    async delete(id: number): Promise<void> {
        const division = await this.findOneBasic(id);
        const tournamentId = division?.tournament?.id;
        await this.divisionRepository.delete(id);
        await this.uiUpdateGateway.emitTournamentUpdate(tournamentId);
    }

    async updateSeeding(id: number, entrantIds: number[]): Promise<void> {
        const division = await this.findEntrantsOnly(id);
        if (!division) throw new NotFoundException(`Division ${id} not found`);

        const entrantsById = new Map((division.entrants ?? []).map((entrant) => [entrant.id, entrant]));
        for (const [index, entrantId] of entrantIds.entries()) {
            const entrant = entrantsById.get(entrantId);
            if (!entrant) throw new NotFoundException(`Entrant ${entrantId} does not belong to division ${id}`);
            entrant.seedNum = index + 1;
            await this.entrantRepository.save(entrant);
        }

        await this.uiUpdateGateway.emitDivisionUpdateByDivisionId(id);
    }
}
