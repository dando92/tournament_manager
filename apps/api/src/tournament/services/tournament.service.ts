import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Tournament, Song } from '@tournament-manager/persistence';
import { MyTournamentRolesDto } from '@tournament-manager/contracts';
import { CreateTournamentDto, UpdateTournamentDto } from '@tournament/dtos';

@Injectable()
export class TournamentService {
    constructor(
        @InjectRepository(Tournament)
        private readonly tournamentRepository: Repository<Tournament>,
        @InjectRepository(Song)
        private readonly songRepository: Repository<Song>,
        private readonly dataSource: DataSource,
    ) {}

    async create(dto: CreateTournamentDto, _ownerId?: string): Promise<Tournament> {
        const tournament = new Tournament();
        tournament.name = dto.name;
        return this.dataSource.transaction(async (manager) => {
            const saved = await manager.getRepository(Tournament).save(tournament);
            return saved;
        });
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
        await this.assertOpen(id);
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

    async close(id: number): Promise<Tournament> {
        return this.changeLifecycle(id, 'closed');
    }

    async reopen(id: number): Promise<Tournament> {
        return this.changeLifecycle(id, 'open');
    }

    async assertOpen(id: number): Promise<void> {
        const tournament = await this.tournamentRepository.findOne({
            where: { id },
            select: { id: true, status: true },
        });
        if (!tournament) throw new NotFoundException(`Tournament with id ${id} not found`);
        if (tournament.status === 'closed') {
            throw new ConflictException(`Tournament with id ${id} is closed and must be reopened before it can be modified`);
        }
    }

    private async changeLifecycle(id: number, status: 'open' | 'closed'): Promise<Tournament> {
        const tournament = await this.tournamentRepository.findOneBy({ id });
        if (!tournament) throw new NotFoundException(`Tournament with id ${id} not found`);
        if (tournament.status === status) return tournament;
        tournament.status = status;
        tournament.closedAt = status === 'closed' ? new Date() : null;
        return this.tournamentRepository.save(tournament);
    }

    async getMyRoles(accountId: string): Promise<MyTournamentRolesDto> {
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
