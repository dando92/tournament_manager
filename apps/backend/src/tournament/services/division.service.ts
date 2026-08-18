import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Division, Entrant, Participant, Tournament } from '@persistence/entities';
import { CreateDivisionDto, UpdateDivisionDto } from '../dtos';
import { UiUpdateGateway } from '@match/gateways/ui-update.gateway';

@Injectable()
export class DivisionService {
    constructor(
        @InjectRepository(Division)
        private readonly divisionRepository: Repository<Division>,
        @InjectRepository(Tournament)
        private readonly tournamentRepository: Repository<Tournament>,
        private readonly uiUpdateGateway: UiUpdateGateway,
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

    async findAll(tournamentId?: number): Promise<Division[]> {
        if (tournamentId) {
            return this.findAllForTournamentCards(tournamentId);
        }
        return this.divisionRepository.find();
    }

    async findOne(id: number): Promise<Division> {
        const division = await this.findOneForView(id);
        if (!division) throw new NotFoundException(`Division ${id} not found`);
        return division;
    }

    async findOneForSummary(id: number): Promise<Division | null> {
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
                        matches: true,
                    },
                },
            },
        });
    }

    async findOneForStandings(id: number): Promise<Division | null> {
        return this.divisionRepository.findOne({
            where: { id },
            relations: {
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
                            matchResult: true,
                            rounds: {
                                standings: {
                                    score: {
                                        player: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
    }

    async findAllForTournamentCards(tournamentId: number): Promise<Division[]> {
        return this.divisionRepository.find({
            where: { tournament: { id: tournamentId } },
            relations: {
                tournament: true,
                entrants: {
                    participants: {
                        player: true,
                    },
                },
                phases: {
                    phaseGroups: {
                        matches: {
                            matchResult: true,
                            entrants: {
                                participants: {
                                    player: true,
                                },
                            },
                            rounds: {
                                song: true,
                                standings: {
                                    score: {
                                        player: true,
                                        song: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
    }

    async findOverviewData(tournamentId: number): Promise<Division[]> {
        return this.divisionRepository
            .createQueryBuilder('division')
            .leftJoinAndSelect('division.entrants', 'entrant')
            .leftJoinAndSelect('entrant.participants', 'participant')
            .leftJoinAndSelect('participant.player', 'player')
            .leftJoinAndSelect('division.phases', 'phase')
            .leftJoinAndSelect('phase.phaseGroups', 'phaseGroup')
            .loadRelationCountAndMap('phaseGroup.matchCount', 'phaseGroup.matches')
            .where('division.tournamentId = :tournamentId', { tournamentId })
            .getMany();
    }

    async findOneForView(id: number): Promise<Division | null> {
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
                            matchResult: true,
                            entrants: {
                                participants: {
                                    player: true,
                                },
                            },
                            rounds: {
                                song: true,
                                standings: {
                                    score: {
                                        player: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
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
        return this.divisionRepository.save(division);
    }

    async delete(id: number): Promise<void> {
        const division = await this.findOneBasic(id);
        const tournamentId = division?.tournament?.id;
        await this.divisionRepository.delete(id);
        await this.uiUpdateGateway.emitTournamentUpdate(tournamentId);
    }

    async getEntrants(id: number): Promise<Entrant[]> {
        const division = await this.findEntrantsOnly(id);
        if (!division) throw new NotFoundException(`Division ${id} not found`);
        return division.entrants ?? [];
    }

    async getAvailableParticipants(id: number): Promise<Participant[]> {
        const division = await this.divisionRepository.findOne({
            where: { id },
            relations: {
                tournament: {
                    participants: {
                        player: true,
                        account: true,
                    },
                },
                entrants: {
                    participants: true,
                },
            },
        });
        if (!division) throw new NotFoundException(`Division ${id} not found`);

        const assignedParticipantIds = new Set(
            (division.entrants ?? [])
                .flatMap((entrant) => entrant.participants ?? [])
                .map((participant) => participant.id),
        );

        return (division.tournament.participants ?? [])
            .filter((participant) => !assignedParticipantIds.has(participant.id));
    }
}
