import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tournament, Song } from '@persistence/entities';
import { CreateTournamentDto, UpdateTournamentDto } from '../dtos';

export interface MyTournamentRoles {
    isAdmin: boolean;
    canCreateTournament: boolean;
    ownedTournamentIds: number[];
    staffTournamentIds: number[];
}

@Injectable()
export class TournamentService {
    constructor(
        @InjectRepository(Tournament)
        private readonly tournamentRepository: Repository<Tournament>,
        @InjectRepository(Song)
        private readonly songRepository: Repository<Song>,
    ) {}

    async create(dto: CreateTournamentDto, _ownerId?: string): Promise<Tournament> {
        const tournament = new Tournament();
        tournament.name = dto.name;
        if (dto.syncstartUrl) tournament.syncstartUrl = dto.syncstartUrl;
        return this.tournamentRepository.save(tournament);
    }

    async findAllPublic(): Promise<Tournament[]> {
        return this.tournamentRepository.find({
            select: {
                id: true,
                name: true,
            },
        });
    }

    async findOne(id: number): Promise<Tournament | null> {
        return this.findOneForPage(id);
    }

    async findOneForPage(id: number): Promise<Tournament | null> {
        return this.tournamentRepository.findOneBy({ id });
    }

    async findOneForUpdate(id: number): Promise<Tournament | null> {
        return this.findOneForPage(id);
    }

    async findSongsByTournamentId(tournamentId: number): Promise<Song[]> {
        return this.songRepository.find({
            where: { tournament: { id: tournamentId } },
        });
    }

    async update(id: number, dto: UpdateTournamentDto): Promise<{ tournament: Tournament; previousSyncstartUrl: string | undefined }> {
        const existing = await this.findOneForUpdate(id);
        if (!existing) throw new NotFoundException(`Tournament with id ${id} not found`);

        const previousSyncstartUrl = existing.syncstartUrl;

        this.tournamentRepository.merge(existing, {
            name: dto.name,
            syncstartUrl: dto.syncstartUrl,
            startggApiKey: dto.startggApiKey,
            availableSetupsCount: dto.availableSetupsCount,
            defaultScoringSystem: dto.defaultScoringSystem,
        });
        const tournament = await this.tournamentRepository.save(existing);
        return { tournament, previousSyncstartUrl };
    }

    async getMyRoles(accountId: string): Promise<MyTournamentRoles> {
        const ownedTournaments = await this.tournamentRepository
            .createQueryBuilder('tournament')
            .leftJoin('tournament.participants', 'participant')
            .leftJoin('participant.account', 'participantAccount')
            .leftJoin('participant.player', 'player')
            .leftJoin('player.account', 'playerAccount')
            .where('(participantAccount.id = :accountId OR playerAccount.id = :accountId)', { accountId })
            .andWhere('participant.roles LIKE :ownerRole', { ownerRole: '%owner%' })
            .select('tournament.id')
            .getMany();

        const staffTournaments = await this.tournamentRepository
            .createQueryBuilder('tournament')
            .leftJoin('tournament.participants', 'participant')
            .leftJoin('participant.account', 'participantAccount')
            .leftJoin('participant.player', 'player')
            .leftJoin('player.account', 'playerAccount')
            .where('(participantAccount.id = :accountId OR playerAccount.id = :accountId)', { accountId })
            .andWhere('participant.roles LIKE :staffRole', { staffRole: '%staff%' })
            .select('tournament.id')
            .getMany();

        return {
            isAdmin: false,
            canCreateTournament: false,
            ownedTournamentIds: ownedTournaments.map((tournament) => tournament.id),
            staffTournamentIds: staffTournaments.map((tournament) => tournament.id),
        };
    }

    async findByPhase(phaseId: number): Promise<Tournament | null> {
        return this.tournamentRepository.findOne({ where: { divisions: { phases: { id: phaseId } } } });
    }
}
