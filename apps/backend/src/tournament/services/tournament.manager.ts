import { Injectable, NotFoundException } from '@nestjs/common';
import { Participant, Player, Tournament } from '@persistence/entities';
import {
    CreateParticipantDto,
    CreateTournamentDto,
    ImportParticipantEntryDto,
    TournamentConfigurationDto,
    TournamentOverviewDto,
    TournamentResponseDto,
    UpdateTournamentDto,
} from '../dtos';
import { DivisionService } from './division.service';
import { TournamentService } from './tournament.service';
import { ParticipantService } from './participant.service';
import { PlayerService } from '@player/player.service';

@Injectable()
export class TournamentManager {
    constructor(
        private readonly divisionService: DivisionService,
        private readonly tournamentService: TournamentService,
        private readonly participantService: ParticipantService,
        private readonly playerService: PlayerService,
    ) {}

    private normalizeName(value: string): string {
        return value.trim().toLowerCase();
    }

    private toParticipantDto(participant: Participant) {
        return {
            id: participant.id,
            roles: participant.roles ?? [],
            status: participant.status,
            player: {
                id: participant.player.id,
                playerName: participant.player.playerName,
            },
        };
    }

    private toResponseDto(tournament: Tournament): TournamentResponseDto {
        return {
            id: tournament.id,
            name: tournament.name,
            syncstartUrl: tournament.syncstartUrl,
            availableSetupsCount: tournament.availableSetupsCount,
            defaultScoringSystem: tournament.defaultScoringSystem,
            staff: (tournament.participants ?? [])
                .filter((participant) => participant.roles?.includes('staff') && participant.account)
                .map((participant) => ({
                    id: participant.account.id,
                    username: participant.account.username,
                })),
        };
    }

    private toConfigurationDto(tournament: Tournament): TournamentConfigurationDto {
        return {
            id: tournament.id,
            name: tournament.name,
            syncstartUrl: tournament.syncstartUrl,
            startggApiKey: tournament.startggApiKey,
            availableSetupsCount: tournament.availableSetupsCount,
            defaultScoringSystem: tournament.defaultScoringSystem,
        };
    }

    async create(dto: CreateTournamentDto, ownerId?: string): Promise<TournamentResponseDto> {
        const tournament = await this.tournamentService.create(dto, ownerId);
        if (ownerId) {
            await this.participantService.ensureOwner(tournament.id, ownerId);
        }
        const reloaded = await this.tournamentService.findOne(tournament.id);
        return this.toResponseDto(reloaded ?? tournament);
    }

    async findOne(tournamentId: number): Promise<TournamentResponseDto | null> {
        const tournament = await this.tournamentService.findOne(tournamentId);
        return tournament ? this.toResponseDto(tournament) : null;
    }

    async findConfiguration(tournamentId: number): Promise<TournamentConfigurationDto> {
        const tournament = await this.tournamentService.findOne(tournamentId);
        if (!tournament) throw new NotFoundException(`Tournament with id ${tournamentId} not found`);
        return this.toConfigurationDto(tournament);
    }

    async hasStartggApiKey(tournamentId: number): Promise<{ hasStartggApiKey: boolean }> {
        const tournament = await this.tournamentService.findOne(tournamentId);
        if (!tournament) throw new NotFoundException(`Tournament with id ${tournamentId} not found`);
        return { hasStartggApiKey: Boolean(tournament.startggApiKey?.trim()) };
    }

    async update(tournamentId: number, dto: UpdateTournamentDto): Promise<{ tournament: TournamentResponseDto; previousSyncstartUrl: string | undefined }> {
        const result = await this.tournamentService.update(tournamentId, dto);
        return {
            tournament: this.toResponseDto(result.tournament),
            previousSyncstartUrl: result.previousSyncstartUrl,
        };
    }

    async listParticipants(tournamentId: number) {
        const participants = await this.participantService.listForTournament(tournamentId);
        return participants.map((participant) => this.toParticipantDto(participant));
    }

    async createParticipant(tournamentId: number, dto: CreateParticipantDto) {
        const trimmedName = dto.playerName?.trim();
        if (!dto.playerId && !trimmedName) {
            throw new NotFoundException('playerId or playerName is required');
        }

        let player: Player | null = null;
        if (dto.playerId) {
            player = await this.playerService.findById(dto.playerId);
            if (!player) throw new NotFoundException(`Player ${dto.playerId} not found`);
        } else if (trimmedName) {
            const allPlayers = await this.playerService.findAll();
            player = allPlayers.find((candidate) => this.normalizeName(candidate.playerName) === this.normalizeName(trimmedName)) ?? null;
            if (!player) {
                player = await this.playerService.create(trimmedName);
            }
        }

        const participant = await this.participantService.ensureForPlayer(tournamentId, player!.id, ['competitor']);
        return this.toParticipantDto(participant);
    }

    async removeParticipant(tournamentId: number, participantId: number): Promise<void> {
        await this.participantService.removeFromTournament(tournamentId, participantId);
    }

    async addParticipantStaffRole(tournamentId: number, participantId: number) {
        const participant = await this.participantService.addStaffRole(tournamentId, participantId);
        return this.toParticipantDto(participant);
    }

    async removeParticipantStaffRole(tournamentId: number, participantId: number) {
        const participant = await this.participantService.removeStaffRole(tournamentId, participantId);
        return this.toParticipantDto(participant);
    }

    async previewParticipantImport(tournamentId: number, playerNames: string[]) {
        const participants = await this.participantService.listForTournament(tournamentId);
        const players = await this.playerService.findAll();
        const playerByNormalizedName = new Map(players.map((player) => [this.normalizeName(player.playerName), player]));
        const participantPlayerIds = new Set(participants.map((participant) => participant.player.id));

        return [...new Set(playerNames.map((name) => name.trim()).filter(Boolean))].map((name) => {
            const matchedPlayer = playerByNormalizedName.get(this.normalizeName(name)) ?? null;
            return {
                name,
                matchedPlayer: matchedPlayer ? { id: matchedPlayer.id, playerName: matchedPlayer.playerName } : null,
                alreadyParticipant: matchedPlayer ? participantPlayerIds.has(matchedPlayer.id) : false,
            };
        });
    }

    async importParticipants(tournamentId: number, entries: ImportParticipantEntryDto[]) {
        const imported = [];

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
            imported.push(this.toParticipantDto(participant));
        }

        return imported;
    }

    async findOverview(tournamentId: number): Promise<TournamentOverviewDto> {
        const divisions = await this.divisionService.findOverviewData(tournamentId);
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
                entrants: (division.entrants ?? []).map((entrant) => ({
                    id: entrant.id,
                    name: entrant.name,
                    type: entrant.type,
                    status: entrant.status,
                    participants: (entrant.participants ?? []).map((participant) => ({
                        id: participant.id,
                        roles: participant.roles ?? [],
                        status: participant.status,
                        player: {
                            id: participant.player.id,
                            playerName: participant.player.playerName,
                        },
                    })),
                })),
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
                    })),
                })),
            })),
        };
    }

    private getPhaseGroupMatchCount(phaseGroup: { matches?: unknown[]; matchCount?: number }): number {
        return phaseGroup.matchCount ?? phaseGroup.matches?.length ?? 0;
    }
}
