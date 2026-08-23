import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Participant, ParticipantRole, Player, Tournament } from '@tournament-manager/persistence';
import { DivisionCommands } from '@tournament/structure/division/division.commands';
import { AccountService } from '@account/services/account.service';

@Injectable()
export class ParticipantService {
    constructor(
        @InjectRepository(Participant)
        private readonly participantRepository: Repository<Participant>,
        @InjectRepository(Tournament)
        private readonly tournamentRepository: Repository<Tournament>,
        @InjectRepository(Player)
        private readonly playerRepository: Repository<Player>,
        private readonly divisionCommands: DivisionCommands,
        private readonly accountService: AccountService,
    ) {}

    async ensureForPlayer(tournamentId: number, playerId: number, roles: ParticipantRole[] = ['competitor']): Promise<Participant> {
        const participant = await this.participantRepository.findOne({
            where: { tournament: { id: tournamentId }, player: { id: playerId } },
            relations: { tournament: true, player: true, account: true },
        });

        if (participant) {
            participant.roles = this.mergeRoles(participant.roles, roles);
            return this.participantRepository.save(participant);
        }

        const tournament = await this.tournamentRepository.findOneBy({ id: tournamentId });
        if (!tournament) throw new NotFoundException(`Tournament ${tournamentId} not found`);

        const player = await this.playerRepository.findOneBy({ id: playerId });
        if (!player) throw new NotFoundException(`Player ${playerId} not found`);

        const created = new Participant();
        created.tournament = tournament;
        created.player = player;
        created.roles = this.mergeRoles([], roles);
        created.status = 'registered';
        return this.participantRepository.save(created);
    }

    async ensureOwner(tournamentId: number, accountId: string): Promise<Participant> {
        const account = await this.accountService.ensurePlayer(accountId);
        const participant = await this.ensureForPlayer(tournamentId, account.player.id, ['owner']);
        participant.account = account;
        participant.roles = this.mergeRoles(participant.roles, ['owner']);
        return this.participantRepository.save(participant);
    }

    async ensureStaff(tournamentId: number, accountId: string): Promise<Participant> {
        const account = await this.accountService.ensurePlayer(accountId);
        const participant = await this.ensureForPlayer(tournamentId, account.player.id, ['staff']);
        participant.account = account;
        participant.roles = this.mergeRoles(participant.roles, ['staff']);
        return this.participantRepository.save(participant);
    }

    async removeFromTournament(tournamentId: number, participantId: number): Promise<void> {
        const participant = await this.participantRepository.findOne({
            where: { id: participantId, tournament: { id: tournamentId } },
            relations: {
                tournament: true,
                player: true,
                entrants: {
                    division: true,
                },
            },
        });

        if (!participant) return;

        /* One call per division the participant competes in, not per entrant of
           a collection: somebody belongs to a division once. */
        for (const divisionId of new Set((participant.entrants ?? []).map((entrant) => entrant.division.id))) {
            await this.divisionCommands.removeParticipant(divisionId, participant.id);
        }

        await this.participantRepository.remove(participant);
    }

    async addStaffRole(tournamentId: number, participantId: number): Promise<Participant> {
        const participant = await this.participantRepository.findOne({
            where: { id: participantId, tournament: { id: tournamentId } },
            relations: { tournament: true, player: true, account: true },
        });
        if (!participant) throw new NotFoundException(`Participant ${participantId} not found`);

        if (!participant.account) {
            const linkedAccount = await this.accountService.findByPlayerId(participant.player.id);
            if (linkedAccount) {
                participant.account = linkedAccount;
            }
        }

        participant.roles = this.mergeRoles(participant.roles, ['staff']);
        return this.participantRepository.save(participant);
    }

    async removeStaffRole(tournamentId: number, participantId: number): Promise<Participant> {
        const participant = await this.participantRepository.findOne({
            where: { id: participantId, tournament: { id: tournamentId } },
            relations: { tournament: true, player: true, account: true },
        });
        if (!participant) throw new NotFoundException(`Participant ${participantId} not found`);

        participant.roles = (participant.roles ?? []).filter((role) => role !== 'staff');
        if (participant.roles.length === 0) participant.roles = ['unknown'];
        return this.participantRepository.save(participant);
    }

    async canEdit(tournamentId: number, accountId: string): Promise<boolean> {
        const participant = await this.participantRepository.findOne({
            where: { tournament: { id: tournamentId }, account: { id: accountId } },
        });
        return participant?.roles?.some((role) => role === 'owner' || role === 'staff') ?? false;
    }

    private mergeRoles(existing: ParticipantRole[] = [], incoming: ParticipantRole[]): ParticipantRole[] {
        const roles = new Set<ParticipantRole>(existing.filter((role) => role !== 'unknown'));
        incoming.forEach((role) => roles.add(role));
        return roles.size > 0 ? Array.from(roles) : ['unknown'];
    }
}
