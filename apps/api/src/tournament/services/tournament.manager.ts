import { Injectable, NotFoundException } from '@nestjs/common';
import { Player } from '@tournament-manager/persistence';
import {
    ParticipantDto,
    TournamentDto,
    TournamentOverviewDto,
} from '@tournament-manager/contracts';
import {
    CreateParticipantDto,
    CreateTournamentDto,
    ImportParticipantEntryDto,
    UpdateTournamentDto,
} from '@tournament/dtos';
import { toEntrantDto, toParticipantDto } from '@tournament/shared/projections';
import { DivisionService } from '@tournament/structure/services/division.service';
import { MatchQueries } from '@match/match.queries';
import { TournamentQueries } from '@tournament/management/tournament.queries';
import { TournamentService } from './tournament.service';
import { ParticipantService } from './participant.service';
import { PlayerService } from '@player/player.service';

@Injectable()
export class TournamentManager {
    constructor(
        private readonly divisionService: DivisionService,
        private readonly matchQueries: MatchQueries,
        private readonly tournamentQueries: TournamentQueries,
        private readonly tournamentService: TournamentService,
        private readonly participantService: ParticipantService,
        private readonly playerService: PlayerService,
    ) {}

    /**
     * A write answers with the projection its `GET` returns, so every one of
     * them ends here rather than mapping the entity it happens to hold.
     */
    private async project(tournamentId: number): Promise<TournamentDto> {
        const tournament = await this.tournamentQueries.byId(tournamentId);
        if (!tournament) throw new NotFoundException(`Tournament with id ${tournamentId} not found`);
        return tournament;
    }

    async create(dto: CreateTournamentDto, ownerId?: string): Promise<TournamentDto> {
        const tournament = await this.tournamentService.create(dto, ownerId);
        if (ownerId) {
            await this.participantService.ensureOwner(tournament.id, ownerId);
        }
        return this.project(tournament.id);
    }

    async update(tournamentId: number, dto: UpdateTournamentDto): Promise<{ tournament: TournamentDto; previousSyncstartUrl: string | undefined }> {
        const result = await this.tournamentService.update(tournamentId, dto);
        return {
            tournament: await this.project(result.tournament.id),
            previousSyncstartUrl: result.previousSyncstartUrl,
        };
    }

    async close(tournamentId: number): Promise<TournamentDto> {
        const tournament = await this.tournamentService.close(tournamentId);
        return this.project(tournament.id);
    }

    async reopen(tournamentId: number): Promise<TournamentDto> {
        const tournament = await this.tournamentService.reopen(tournamentId);
        return this.project(tournament.id);
    }

    async createParticipant(tournamentId: number, dto: CreateParticipantDto): Promise<ParticipantDto> {
        const trimmedName = dto.playerName?.trim();
        if (!dto.playerId && !trimmedName) {
            throw new NotFoundException('playerId or playerName is required');
        }

        let player: Player | null = null;
        if (dto.playerId) {
            player = await this.playerService.findById(dto.playerId);
            if (!player) throw new NotFoundException(`Player ${dto.playerId} not found`);
        } else if (trimmedName) {
            player = await this.playerService.findByNameNormalized(trimmedName)
                ?? await this.playerService.create(trimmedName);
        }

        const participant = await this.participantService.ensureForPlayer(tournamentId, player!.id, ['competitor']);
        return toParticipantDto(participant);
    }

    async removeParticipant(tournamentId: number, participantId: number): Promise<void> {
        await this.participantService.removeFromTournament(tournamentId, participantId);
    }

    async addParticipantStaffRole(tournamentId: number, participantId: number): Promise<ParticipantDto> {
        const participant = await this.participantService.addStaffRole(tournamentId, participantId);
        return toParticipantDto(participant);
    }

    async removeParticipantStaffRole(tournamentId: number, participantId: number): Promise<ParticipantDto> {
        const participant = await this.participantService.removeStaffRole(tournamentId, participantId);
        return toParticipantDto(participant);
    }

    async importParticipants(tournamentId: number, entries: ImportParticipantEntryDto[]): Promise<ParticipantDto[]> {
        const imported: ParticipantDto[] = [];

        for (const entry of entries) {
            const trimmedName = entry.name.trim();
            if (!trimmedName) continue;

            let player: Player | null = null;
            if (entry.playerId) {
                player = await this.playerService.findById(entry.playerId);
                if (!player) throw new NotFoundException(`Player ${entry.playerId} not found`);
            } else {
                player = await this.playerService.create(trimmedName);
            }

            const participant = await this.participantService.ensureForPlayer(tournamentId, player.id, ['competitor']);
            imported.push(toParticipantDto(participant));
        }

        return imported;
    }

    async findOverview(tournamentId: number): Promise<TournamentOverviewDto> {
        const divisions = await this.divisionService.findOverviewData(tournamentId);
        /* The tree marks a branch that is waiting on a person, so the overview
           carries the count the sidebar rolls up. One aggregate for the whole
           tournament rather than a load of its matches. */
        const pendingMatchCounts = await this.matchQueries.pendingCountsByPhaseGroup(tournamentId);
        const divisionCount = divisions.length;
        const playerCount = divisions.reduce(
            (count, division) => count + (division.entrants?.filter((entrant) => entrant.status === 'active').length ?? 0),
            0,
        );
        const matchCount = divisions.reduce(
            (count, division) =>
                count + (division.phases ?? []).reduce(
                    (phaseCount, phase) =>
                        phaseCount + (phase.phaseGroups ?? []).reduce((groupCount, phaseGroup) => groupCount + this.getPhaseGroupMatchCount(phaseGroup), 0),
                    0,
                ),
            0,
        );

        return {
            divisionCount,
            playerCount,
            matchCount,
            divisions: divisions.map((division) => ({
                id: division.id,
                name: division.name,
                entrants: (division.entrants ?? []).map(toEntrantDto),
                phases: (division.phases ?? []).map((phase) => ({
                    id: phase.id,
                    name: phase.name,
                    matchCount: (phase.phaseGroups ?? []).reduce((count, phaseGroup) => count + this.getPhaseGroupMatchCount(phaseGroup), 0),
                    phaseGroups: (phase.phaseGroups ?? []).map((phaseGroup) => ({
                        id: phaseGroup.id,
                        name: phaseGroup.name,
                        displayIdentifier: phaseGroup.displayIdentifier ?? null,
                        bracketType: phaseGroup.bracketType ?? null,
                        state: phaseGroup.state,
                        entrants: [],
                        matchCount: this.getPhaseGroupMatchCount(phaseGroup),
                        pendingMatchCount: pendingMatchCounts.get(phaseGroup.id) ?? 0,
                    })),
                })),
            })),
        };
    }

    private getPhaseGroupMatchCount(phaseGroup: { matches?: unknown[]; matchCount?: number }): number {
        return phaseGroup.matchCount ?? phaseGroup.matches?.length ?? 0;
    }
}
