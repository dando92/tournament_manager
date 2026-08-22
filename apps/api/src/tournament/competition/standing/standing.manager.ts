import { BadRequestException, Injectable, Inject, NotFoundException } from "@nestjs/common";
import { Match, Player, Round, Score, Standing } from '@tournament-manager/persistence';
import { ScoringSystemProvider } from '@tournament-manager/scoring';
import { UiUpdatePublisher } from '@match/services/ui-update.publisher';
import { MatchService } from '@match/services/match.service';
import { MatchWorkflowManager } from '@match/services/match-workflow.manager';
import { RoundService } from '../services/round.service';
import { ScoreService } from '../services/score.service';
import { StandingService } from './standing.service';

type PlayedStanding = Standing & { score: Score };

function isPlayed(standing: Standing): standing is PlayedStanding {
    return Boolean(standing.score);
}

/**
 * Writing the points of a player into a round.
 *
 * A round is the address, not a song: a hand-scored round has no song and would
 * otherwise be unreachable. Both ways of filling a cell end in the same upsert
 * and the same row, and everything that reads a standing afterwards treats them
 * alike.
 *
 * The two are kept apart only at the door. Points on a round with a song are
 * not the caller's to set — the scoring system computes them from the
 * percentages and the next recalculation would overwrite anything written by
 * hand — and a round without a song has nothing to score.
 */
@Injectable()
export class StandingManager {
    constructor(
        @Inject()
        private readonly standingService: StandingService,
        @Inject()
        private readonly roundService: RoundService,
        @Inject()
        private readonly matchService: MatchService,
        @Inject()
        private readonly matchWorkflowManager: MatchWorkflowManager,
        @Inject()
        private readonly scoreService: ScoreService,
        @Inject()
        private readonly scoringSystemProvider: ScoringSystemProvider,
        @Inject()
        private readonly uiUpdateGateway: UiUpdatePublisher,
    ) { }

    /** A played result: the percentage the cabinet reported, or one typed in its place. */
    async upsertScore(
        roundId: number,
        playerId: number,
        input: { percentage: number; isFailed: boolean; scoreId?: number },
    ): Promise<Match> {
        const { match, round } = await this.loadRound(roundId);
        this.matchWorkflowManager.assertEditable(match);

        if (!round.song) {
            throw new BadRequestException(`Round ${roundId} is hand-scored and has no song to score`);
        }

        const score = input.scoreId
            ? await this.getExistingScore(input.scoreId, playerId, round.song.id)
            : await this.scoreService.create({
                playerId,
                songId: round.song.id,
                percentage: input.percentage,
                isFailed: input.isFailed,
            });

        await this.writeStanding(round, playerId, { score, points: 0 });
        await this.recalculateRoundIfComplete(match, round);
        await this.uiUpdateGateway.emitMatchUpdateByMatchId(match.id);

        return match;
    }

    /** A stated result: points a person assigned, with nothing played behind them. */
    async upsertPoints(roundId: number, playerId: number, points: number): Promise<Match> {
        const { match, round } = await this.loadRound(roundId);
        this.matchWorkflowManager.assertEditable(match);

        if (round.song) {
            throw new BadRequestException(
                `Round ${roundId} is scored from song ${round.song.id}; its points are computed, not assigned`,
            );
        }

        await this.writeStanding(round, playerId, { score: null, points });
        await this.uiUpdateGateway.emitMatchUpdateByMatchId(match.id);

        return match;
    }

    async removeStanding(roundId: number, playerId: number): Promise<Match> {
        const { match, round } = await this.loadRound(roundId);
        this.matchWorkflowManager.assertEditable(match);

        const standing = round.standings.find((candidate) => candidate.player.id === playerId);
        if (standing) {
            await this.standingService.delete(standing.id);
            round.standings = round.standings.filter((candidate) => candidate.id !== standing.id);

            /* The round is incomplete again, so the ranking it produced no
               longer means anything and must not be left behind. */
            if (round.song) {
                round.standings.forEach((candidate) => (candidate.points = 0));
                await this.standingService.savePoints(round.standings);
            }
        }

        await this.uiUpdateGateway.emitMatchUpdateByMatchId(match.id);

        return match;
    }

    /**
     * The SyncStart path. A completed song arrives naming its song, so the round
     * is resolved from it and the write is the ordinary one.
     */
    async applyPlayedScore(match: Match, score: Score): Promise<Match> {
        this.matchWorkflowManager.assertEditable(match);

        const round = match.rounds.find((candidate) => candidate.song?.id === score.song.id);
        if (!round) return match;

        await this.writeStanding(round, score.player.id, { score, points: 0 });
        await this.recalculateRoundIfComplete(match, round);
        await this.uiUpdateGateway.emitMatchUpdateByMatchId(match.id);

        return match;
    }

    private async loadRound(roundId: number): Promise<{ match: Match; round: Round }> {
        const stored = await this.roundService.findOneWithMatch(roundId);
        if (!stored) throw new NotFoundException(`Round with id ${roundId} not found`);

        const match = await this.matchService.getMatch(stored.match.id);
        if (!match) throw new NotFoundException(`Match with id ${stored.match.id} not found`);

        const round = match.rounds.find((candidate) => candidate.id === roundId);
        if (!round) throw new NotFoundException(`Round with id ${roundId} not found in match ${match.id}`);

        return { match, round };
    }

    /** Keeps the in-memory round in step with the row, so the recalculation below sees it. */
    private async writeStanding(
        round: Round,
        playerId: number,
        values: { score?: Score | null; points: number },
    ): Promise<void> {
        const saved = await this.standingService.upsert(round.id, playerId, values);
        const existing = round.standings.findIndex((candidate) => candidate.player?.id === playerId);
        if (existing === -1) round.standings.push(saved);
        else round.standings[existing] = saved;
    }

    private async getExistingScore(scoreId: number, playerId: number, songId: number): Promise<Score> {
        const score = await this.scoreService.findOne(scoreId);
        if (!score) {
            throw new NotFoundException(`Score with id ${scoreId} not found`);
        }
        if (score.player.id !== playerId || score.song.id !== songId) {
            throw new BadRequestException(`Score ${scoreId} does not match the selected player and song`);
        }
        return score;
    }

    private async recalculateRoundIfComplete(match: Match, round: Round): Promise<void> {
        const matchPlayers = this.getSinglesPlayers(match);
        const isRoundCompleted = matchPlayers.every((player) =>
            round.standings.some((standing) => standing.player.id === player.id),
        );

        if (matchPlayers.length === 0 || !isRoundCompleted) {
            return;
        }

        /* A scoring system ranks percentages, so it is only ever handed the
           standings that have a score behind them. On a round with a song that
           is all of them. */
        const scoreSystem = this.scoringSystemProvider.getScoringSystem(match.scoringSystem);
        scoreSystem.recalc(round.standings.filter(isPlayed));

        await this.standingService.savePoints(round.standings);
    }

    private getSinglesPlayers(match: Match): Player[] {
        return (match.entrants ?? [])
            .filter((entrant) => entrant.type === 'player')
            .map((entrant) => entrant.participants?.[0]?.player)
            .filter(Boolean);
    }
}
