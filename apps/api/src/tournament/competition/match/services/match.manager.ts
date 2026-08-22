import { BadRequestException, Injectable, Inject, NotFoundException } from '@nestjs/common';
import { CreateRoundDto, RoundSourceDto } from '@tournament/dtos';
import { CommitMatchResultResponseDto, UpdateMatchActiveDto, UpdateMatchDto } from '@match/dtos/match.dto';
import { Match } from '@tournament-manager/persistence';
import { SongRoller } from '@tournament/competition/services/song.roller';
import { UiUpdatePublisher } from '@match/services/ui-update.publisher';
import { MatchService } from '@match/services/match.service';
import { RoundService } from '@tournament/competition/services/round.service';
import { StandingService } from '@tournament/competition/standing/standing.service';
import { MatchListDto } from '@match/dtos/match-list.dto';
import { MatchWorkflowManager } from '@match/services/match-workflow.manager';
import { AdvancementRuleService } from '@tournament/structure/services/advancement-rule.service';

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
        private readonly uiUpdateGateway: UiUpdatePublisher,
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
                if (playerIdsToRemove.includes(standing.player.id)) {
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

    async CommitMatchResult(matchId: number): Promise<CommitMatchResultResponseDto> {
        const outcome = await this.matchWorkflowManager.CommitMatchResult(matchId);

        return {
            match: await this.GetMatchForView(matchId),
            startggReport: outcome.startggReport,
        };
    }

    async ReopenMatchResult(matchId: number): Promise<MatchListDto | null> {
        await this.matchWorkflowManager.ReopenMatchResult(matchId);
        return await this.GetMatchForView(matchId);
    }

    /**
     * Adds one round to a match.
     *
     * A song makes it a played round, a roll picks the song, and nothing at all
     * makes it the hand-scored one. The database refuses a second hand-scored
     * round and a repeated song, so those rules do not have to be re-checked
     * here.
     */
    public async AddRound(matchId: number, dto: RoundSourceDto): Promise<MatchListDto | null> {
        const match = await this.GetMatch(matchId);
        if (!match) return null;
        this.matchWorkflowManager.assertEditable(match);

        /* A match is scored one way or the other. The model allows both kinds of
           round side by side and the commit would sum them, but mixing them is
           deliberately not offered yet: see .ai/ScoringRefactoring.md. */
        const wantsSong = Boolean(dto.songId || dto.level);
        const handScored = (match.rounds ?? []).some((round) => !round.song);

        if (wantsSong && handScored) {
            throw new BadRequestException(`Match ${match.id} is scored by hand; remove hand scoring before adding songs`);
        }
        if (!wantsSong && (match.rounds ?? []).length > 0) {
            throw new BadRequestException(`Match ${match.id} already has songs; remove them before scoring it by hand`);
        }

        if (dto.songId) {
            await this.AddSongsToMatch(match, [dto.songId]);
        } else if (dto.level) {
            await this.AddRandomSongsToMatch(match, dto.tournamentId, dto.divisionId, dto.group, dto.level);
        } else {
            await this.AddRoundToMatch(match, null);
            await this.uiUpdateGateway.emitMatchUpdateByMatchId(match.id);
        }

        return await this.GetMatchForView(matchId);
    }

    /**
     * Removes a round, and with it whatever was scored in it.
     *
     * Scores are not thrown away on the way past: a round played on a song
     * keeps them, and asking to drop one that still holds them is refused in
     * words. The hand-scored round is the exception, because deleting it is how
     * the interface turns hand scoring off, and it asks first.
     *
     * Nothing here answers silently. Refusing without saying so is what leaves
     * a card showing a round the server has already made up its mind about.
     */
    public async RemoveRound(roundId: number): Promise<MatchListDto | null> {
        const round = await this.roundService.findOneWithMatch(roundId);
        if (!round) throw new NotFoundException(`Round with id ${roundId} not found`);

        const match = await this.GetMatch(round.match.id);
        if (!match) throw new NotFoundException(`Match with id ${round.match.id} not found`);
        this.matchWorkflowManager.assertEditable(match);

        const loaded = match.rounds.find((candidate) => candidate.id === roundId);
        const scored = (loaded?.standings?.length ?? 0) > 0;
        if (scored && loaded?.song) {
            throw new BadRequestException(
                `Round ${roundId} still holds scores for "${loaded.song.title}"; delete them before removing the song`,
            );
        }

        await this.roundService.delete(roundId);
        await this.uiUpdateGateway.emitMatchUpdateByMatchId(match.id);

        return await this.GetMatchForView(match.id);
    }

    /**
     * Swapping the song of a round drops the round and creates another, because
     * the standings under it were scored on the song that is leaving.
     */
    public async ReplaceRoundSong(roundId: number, dto: RoundSourceDto): Promise<MatchListDto | null> {
        const round = await this.roundService.findOneWithMatch(roundId);
        if (!round) throw new NotFoundException(`Round with id ${roundId} not found`);

        const matchId = round.match.id;
        await this.RemoveRound(roundId);

        return await this.AddRound(matchId, dto);
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
            await this.AddRoundToMatch(match, songId);
        }

        await this.uiUpdateGateway.emitMatchUpdateByMatchId(match.id);
        return match;
    }

    private async AddRoundToMatch(match: Match, songId: number | null): Promise<void> {
        const round = await this.roundService.create(this.GetRoundDto(match, songId));

        delete round.match;

        if (!match.rounds) {
            match.rounds = [];
        }
        match.rounds.push(round);
    }

    private GetRoundDto(match: Match, songId: number | null): CreateRoundDto {
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
                song: round.song
                    ? {
                        id: round.song.id,
                        title: round.song.title,
                    }
                    : null,
                standings: (round.standings ?? []).map((standing) => ({
                    id: standing.id,
                    points: standing.points,
                    player: {
                        id: standing.player.id,
                        playerName: standing.player.playerName,
                    },
                    score: standing.score
                        ? {
                            id: standing.score.id,
                            percentage: standing.score.percentage,
                            isFailed: standing.score.isFailed,
                        }
                        : null,
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
