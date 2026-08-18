import { Injectable, Inject } from '@nestjs/common';
import { CreateRoundDto } from '@tournament/dtos';
import { CommitMatchResultDto, UpdateMatchActiveDto, UpdateMatchDto } from '@match/dtos/match.dto';
import { Match } from '@persistence/entities';
import { SongRoller } from '@tournament/services/song.roller';
import { UiUpdateGateway } from '@match/gateways/ui-update.gateway';
import { MatchService } from '@match/services/match.service';
import { RoundService } from '@tournament/services/round.service';
import { StandingService } from '@tournament/standing/standing.service';
import { MatchListDto } from '@match/dtos/match-list.dto';
import { MatchWorkflowManager } from '@match/services/match-workflow.manager';
import { AdvancementRuleService } from '@tournament/services/advancement-rule.service';

@Injectable()
export class MatchManager {
    constructor(
        @Inject()
        private readonly matchService: MatchService,
        @Inject()
        private readonly songExtractor: SongRoller,
        @Inject()
        private readonly standingService: StandingService,
        @Inject()
        private readonly roundService: RoundService,
        @Inject()
        private readonly uiUpdateGateway: UiUpdateGateway,
        @Inject()
        private readonly matchWorkflowManager: MatchWorkflowManager,
        @Inject()
        private readonly advancementRuleService: AdvancementRuleService,
    ) {
    }

    async GetMatch(id: number): Promise<Match | null> {
        return await this.matchService.getMatch(id);
    }

    async GetMatchForView(id: number): Promise<MatchListDto | null> {
        const match = await this.matchService.getMatch(id);
        if (!match) return null;
        return await this.toMatchListDto(match);
    }

    async UpdateMatch(id: number, dto: UpdateMatchDto): Promise<Match> {
        const match = await this.matchService.getMatch(id);
        if (match && (dto.entrantIds !== undefined || dto.phaseGroupId !== undefined || dto.scoringSystem !== undefined)) {
            this.matchWorkflowManager.assertEditable(match);
        }
        return await this.matchService.update(id, dto);
    }

    async DeleteMatch(id: number): Promise<void> {
        return await this.matchService.delete(id);
    }

    async FindMatchesForDivision(divisionId: number): Promise<MatchListDto[]> {
        const matches = await this.matchService.findByDivisionForView(divisionId);
        return await Promise.all(matches.map((match) => this.toMatchListDto(match)));
    }

    async FindMatchesForPhaseGroup(phaseGroupId: number): Promise<MatchListDto[]> {
        const matches = await this.matchService.findByPhaseGroupForView(phaseGroupId);
        return await Promise.all(matches.map((match) => this.toMatchListDto(match)));
    }

    async RemovePlayersFromMatch(matchId: number, playerIdsToRemove: number[]): Promise<void> {
        const match = await this.matchService.getMatch(matchId);
        if (!match) return;
        this.matchWorkflowManager.assertEditable(match);

        for (const round of match.rounds ?? []) {
            for (const standing of round.standings ?? []) {
                if (playerIdsToRemove.includes(standing.score.player.id)) {
                    await this.standingService.delete(standing.id);
                }
            }
        }

        const remainingEntrantIds = (match.entrants ?? [])
            .filter(entrant => !entrant.participants?.some(participant => playerIdsToRemove.includes(participant.player.id)))
            .map(entrant => entrant.id);
        const dto = new UpdateMatchDto();
        dto.entrantIds = remainingEntrantIds;
        await this.matchService.update(matchId, dto);
    }

    async AddEntrantInMatch(matchId: number, entrantId: number): Promise<void> {
        await this.matchWorkflowManager.AddEntrantInMatch(matchId, entrantId);
    }

    async RemoveEntrantInMatch(matchId: number, entrantId: number): Promise<void> {
        await this.matchWorkflowManager.RemoveEntrantInMatch(matchId, entrantId);
    }

    async UpdateMatchActive(matchId: number, dto: UpdateMatchActiveDto): Promise<MatchListDto | null> {
        await this.matchWorkflowManager.UpdateMatchActive(matchId, dto);
        return await this.GetMatchForView(matchId);
    }

    async CommitMatchResult(matchId: number, dto: CommitMatchResultDto): Promise<MatchListDto | null> {
        await this.matchWorkflowManager.CommitMatchResult(matchId, dto);
        return await this.GetMatchForView(matchId);
    }

    async ReopenMatchResult(matchId: number): Promise<MatchListDto | null> {
        await this.matchWorkflowManager.ReopenMatchResult(matchId);
        return await this.GetMatchForView(matchId);
    }

    public async AddSongsToMatchById(matchId: number, songIds: number[]): Promise<void> {
        const match = await this.GetMatch(matchId);

        if (!match) {
            return;
        }
        this.matchWorkflowManager.assertEditable(match);

        await this.AddSongsToMatch(match, songIds);
    }

    public async AddRandomSongsToMatchById(matchId: number, tournamentId: number, divisionId: number, group: string, levels: string): Promise<void> {
        const match = await this.GetMatch(matchId);

        if (!match) {
            return;
        }
        this.matchWorkflowManager.assertEditable(match);

        await this.AddRandomSongsToMatch(match, tournamentId, divisionId, group, levels);
    }

    public async RemoveSongFromMatchById(matchId: number, songId: number): Promise<void> {
        const match = await this.GetMatch(matchId);

        if (!match) {
            return;
        }
        this.matchWorkflowManager.assertEditable(match);

        await this.RemoveSongFromMatch(match, songId);
    }

    private async RemoveSongFromMatch(match: Match, songId: number): Promise<void> {
        this.matchWorkflowManager.assertEditable(match);
        const round = match.rounds.find(round => round.song.id == songId);

        if (!round) {
            return;
        }

        //TODO: how to request "are you sure???" when standings are filled
        if (round.standings.length > 0) {
            return;
        }

        await this.roundService.delete(round.id);
        match.rounds = match.rounds.filter((candidate) => candidate.id !== round.id);
        await this.uiUpdateGateway.emitMatchUpdateByMatchId(match.id);
    }

    public async AddRandomSongsToMatch(match: Match, tournamentId: number, divisionId: number, group: string, levels: string): Promise<Match> {
        this.matchWorkflowManager.assertEditable(match);
        const songIds = await this.songExtractor.RollSongs(tournamentId, divisionId, group, levels);

        return await this.AddSongsToMatch(match, songIds);
    }

    public async AddSongsToMatch(match: Match, songIds: number[]): Promise<Match> {
        this.matchWorkflowManager.assertEditable(match);
        if (!match.rounds) {
            match.rounds = [];
        }
        for (const songId of songIds) {
            await this.AddSongToMatch(match, songId);
        }

        await this.uiUpdateGateway.emitMatchUpdateByMatchId(match.id);
        return match;
    }

    private async AddSongToMatch(match: Match, songId: number): Promise<void> {
        const round = await this.roundService.create(this.GetRoundDto(match, songId));

        delete round.match;

        match.rounds.push(round);
    }

    private GetRoundDto(match: Match, songId: number): CreateRoundDto {
        const dto = new CreateRoundDto();
        dto.matchId = match.id;
        dto.songId = songId;
        return dto;
    }

    private async toMatchListDto(match: Match): Promise<MatchListDto> {
        const outgoingRules = await this.advancementRuleService.findBySource('match', match.id);
        const incomingRules = await this.advancementRuleService.findByTarget('match', match.id);
        const advancementRules = [...outgoingRules, ...incomingRules]
            .filter((rule, index, rules) => rules.findIndex((candidate) => candidate.id === rule.id) === index)
            .sort((left, right) => left.sourceId - right.sourceId || left.sourcePlacement - right.sourcePlacement || left.targetSlot - right.targetSlot || left.id - right.id);

        return {
            id: match.id,
            name: match.name,
            subtitle: match.subtitle,
            notes: match.notes,
            scoringSystem: match.scoringSystem,
            active: match.active ?? false,
            entrants: (match.entrants ?? []).map((entrant) => ({
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
            rounds: (match.rounds ?? []).map((round) => ({
                id: round.id,
                song: {
                    id: round.song.id,
                    title: round.song.title,
                },
                standings: (round.standings ?? []).map((standing) => ({
                    id: standing.id,
                    points: standing.points,
                    score: {
                        id: standing.score.id,
                        percentage: standing.score.percentage,
                        isFailed: standing.score.isFailed,
                        player: {
                            id: standing.score.player.id,
                            playerName: standing.score.player.playerName,
                        },
                        song: {
                            id: round.song.id,
                            title: round.song.title,
                        },
                    },
                })),
            })),
            advancementRules: advancementRules.map((rule) => ({
                id: rule.id,
                sourceKind: rule.sourceKind,
                sourceId: rule.sourceId,
                sourcePlacement: rule.sourcePlacement,
                targetKind: rule.targetKind,
                targetId: rule.targetId,
                targetSlot: rule.targetSlot,
            })),
            matchResult: match.matchResult
                ? {
                    id: match.matchResult.id,
                    playerPoints: match.matchResult.playerPoints ?? [],
                }
                : null,
            phaseGroupId: match.phaseGroup.id,
        };
    }
}
