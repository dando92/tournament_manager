import { BadRequestException, Injectable, Inject, NotFoundException } from "@nestjs/common";
import { CreateScoreDto, CreateStandingDto, UpdateStandingDto } from '../dtos';
import { Match, Player, Score } from '@persistence/entities';
import { ScoringSystemProvider } from "../services/scoring-systems/ScoringSystemProvider";
import { UiUpdateGateway } from '@match/gateways/ui-update.gateway';
import { ILobbyObserver, LobbySongCompletedDto } from '@syncstart/index';
import { MatchService } from '@match/services/match.service';
import { MatchWorkflowManager } from '@match/services/match-workflow.manager';
import { ParticipantService } from '../services/participant.service';
import { ScoreService } from '../services/score.service';
import { SongService } from '../services/song.service';
import { StandingService } from './standing.service';

@Injectable()
export class StandingManager implements ILobbyObserver {
    constructor(
        @Inject()
        private readonly standingService: StandingService,
        @Inject()
        private readonly matchService: MatchService,
        @Inject()
        private readonly matchWorkflowManager: MatchWorkflowManager,
        @Inject()
        private readonly scoreService: ScoreService,
        @Inject()
        private readonly participantService: ParticipantService,
        @Inject()
        private readonly songService: SongService,
        @Inject()
        private readonly scoringSystemProvider: ScoringSystemProvider,
        @Inject()
        private readonly uiUpdateGateway: UiUpdateGateway,
    ) { }

    async AddScoreToMatchById(matchId: number, score: CreateScoreDto, scoreId?: number): Promise<Match> {
        const match = await this.matchService.getMatch(matchId);

        if (!match) {
            console.warn(`[StandingManager] No match found with id "${matchId}"`);
            return;
        }
        this.matchWorkflowManager.assertEditable(match);

        const actualScoreEntity = scoreId
            ? await this.getExistingScoreForStanding(scoreId, score.playerId, score.songId)
            : await this.scoreService.create(score);

        return await this.AddScoreToMatch(match, actualScoreEntity);
    }

    async AddScoreToMatch(match: Match, score: Score): Promise<Match> {
        this.matchWorkflowManager.assertEditable(match);
        const round = match.rounds.find((candidate) => candidate.song.id == score.song.id);

        if (!round) {
            return;
        }

        const alreadyExistentStanding = round.standings.find(
            (standing) => standing.score.song.id == score.song.id && standing.score.player.id == score.player.id,
        );

        if (alreadyExistentStanding) {
            const updateStanding = new UpdateStandingDto();
            updateStanding.scoreId = score.id;
            updateStanding.points = 0;
            await this.standingService.update(alreadyExistentStanding.id, updateStanding);
            alreadyExistentStanding.score = score;
            alreadyExistentStanding.points = 0;
        } else {
            const newStanding = new CreateStandingDto();
            newStanding.roundId = round.id;
            newStanding.scoreId = score.id;
            newStanding.points = 0;

            const standing = await this.standingService.create(newStanding);
            round.standings.push(standing);
        }

        console.log(`[StandingManager]${score.player.playerName} ${score.song.title} standings length ${round.standings.length}`);

        await this.recalculateRoundIfComplete(match, round);

        await this.uiUpdateGateway.emitMatchUpdateByMatchId(match.id);

        return match;
    }

    async AddScoreToEmptyStanding(match: Match, score: Score): Promise<Match> {
        this.matchWorkflowManager.assertEditable(match);
        const round = match.rounds.find((candidate) => candidate.song.id == score.song.id);

        if (!round) {
            return match;
        }

        const alreadyExistentStanding = round.standings.find(
            (standing) => standing.score.song.id == score.song.id && standing.score.player.id == score.player.id,
        );

        if (alreadyExistentStanding) {
            return match;
        }

        const newStanding = new CreateStandingDto();
        newStanding.roundId = round.id;
        newStanding.scoreId = score.id;
        newStanding.points = 0;

        const standing = await this.standingService.create(newStanding);
        round.standings.push(standing);

        await this.recalculateRoundIfComplete(match, round);
        await this.uiUpdateGateway.emitMatchUpdateByMatchId(match.id);

        return match;
    }

    async RemoveStandingFromMatch(matchId: number, playerId: number, songId: number): Promise<Match> {
        const match = await this.matchService.getMatch(matchId);

        if (!match) {
            return;
        }
        this.matchWorkflowManager.assertEditable(match);

        const round = match.rounds.find((candidate) => candidate.song.id == songId);

        if (!round) {
            return;
        }

        try {
            let index = -1;

            for (let i = 0; i < round.standings.length; i++) {
                const standing = round.standings[i];

                if (standing.score.player.id == playerId && standing.score.song.id == songId) {
                    await this.standingService.delete(standing.id);
                    index = i;
                }
            }

            if (index != -1) {
                round.standings.splice(index, 1);

                for (let i = 0; i < round.standings.length; i++) {
                    const standing = round.standings[i];
                    const dto = new UpdateStandingDto();
                    dto.points = 0;
                    await this.standingService.update(standing.id, dto);
                    standing.points = 0;
                }
            }
        } catch (error) {
            console.log(error);
        }

        await this.uiUpdateGateway.emitMatchUpdateByMatchId(match.id);

        return match;
    }

    async EditStandingInMatch(
        matchId: number,
        playerId: number,
        songId: number,
        percentage: number,
        isFailed: boolean,
        scoreId?: number,
    ): Promise<Match> {
        const match = await this.matchService.getMatch(matchId);

        if (!match) {
            return;
        }
        this.matchWorkflowManager.assertEditable(match);

        const round = match.rounds.find((candidate) => candidate.song.id == songId);

        if (!round) {
            return;
        }

        const standing = round.standings.find((candidate) => candidate.score.player.id == playerId);

        if (!standing) {
            return;
        }

        if (scoreId) {
            const updateStandingDto = new UpdateStandingDto();
            updateStandingDto.scoreId = scoreId;
            const updatedStanding = await this.standingService.update(standing.id, updateStandingDto);
            standing.score = updatedStanding.score;
        } else {
            const score = await this.scoreService.create({
                playerId,
                songId,
                percentage,
                isFailed,
            });
            const updateStandingDto = new UpdateStandingDto();
            updateStandingDto.scoreId = score.id;
            const updatedStanding = await this.standingService.update(standing.id, updateStandingDto);
            standing.score = updatedStanding.score;
        }

        const scoreSystem = this.scoringSystemProvider.getScoringSystem(match.scoringSystem);
        scoreSystem.recalc(round.standings);

        for (const currentStanding of round.standings) {
            const dto = new UpdateStandingDto();
            dto.points = currentStanding.points;
            await this.standingService.update(currentStanding.id, dto);
        }

        await this.uiUpdateGateway.emitMatchUpdateByMatchId(match.id);

        return match;
    }

    async OnSongCompleted(event: LobbySongCompletedDto): Promise<void> {
        for (const score of event.scores) {
            if (score.exScore == null) {
                this.uiUpdateGateway.emitWarning(
                    event.tournamentId,
                    `No EX score found for ${score.playerName} on "${event.song.songPath}". Score was not saved.`,
                );
                continue;
            }

            await this.registerLobbyScore(
                event.tournamentId,
                event.song.songPath,
                score.playerName,
                score.exScore,
                score.isFailed,
            );
        }
    }

    private async registerLobbyScore(
        tournamentId: number,
        songPath: string,
        playerName: string,
        percentage: number,
        isFailed: boolean,
    ): Promise<void> {
        const participant = await this.participantService.findForTournamentByPlayerNameNormalized(tournamentId, playerName);
        const song = await this.songService.findByTitleAndTournament(songPath, tournamentId);

        if (!participant?.player || !song) {
            this.uiUpdateGateway.emitWarning(
                tournamentId,
                `No database player-song found for ${playerName} on "${songPath}". Score was not saved.`,
            );
            return;
        }

        const player = participant.player;

        const score = await this.scoreService.create({
            playerId: player.id,
            songId: song.id,
            percentage,
            isFailed,
        });

        const matches = await this.matchService.findActiveByTournamentForLobbyLookup(tournamentId);
        const candidates = matches.filter(
            (candidate) =>
                candidate.rounds?.some((round) => round.song?.id === song.id) &&
                this.getSinglesPlayers(candidate).some((candidatePlayer) => candidatePlayer.id === player.id),
        );

        if (candidates.length === 0) {
            return;
        }

        const emptyCandidate = candidates.find((candidate) => {
            const matchPlayer = this.getSinglesPlayers(candidate).find((candidatePlayer) => candidatePlayer.id === player.id);
            const round = candidate.rounds.find((currentRound) => currentRound.song.id === song.id);
            return matchPlayer && round && !(round.standings ?? []).some(
                (standing) => standing.score.player.id === matchPlayer.id && standing.score.song.id === round.song.id,
            );
        });
        const targetCandidate = emptyCandidate ?? candidates[0];
        const matchPlayer = this.getSinglesPlayers(targetCandidate).find((candidatePlayer) => candidatePlayer.id === player.id);
        const matchRound = targetCandidate.rounds.find((candidateRound) => candidateRound.song.id === song.id);

        if (!matchPlayer || !matchRound) {
            this.uiUpdateGateway.emitWarning(
                tournamentId,
                `Unable to resolve score target for ${playerName} on "${songPath}". Score was not saved.`,
            );
            return;
        }

        if (!emptyCandidate) {
            return;
        }

        await this.AddScoreToEmptyStanding(emptyCandidate, score);
    }

    private async getExistingScoreForStanding(scoreId: number, playerId: number, songId: number): Promise<Score> {
        const score = await this.scoreService.findOne(scoreId);
        if (!score) {
            throw new NotFoundException(`Score with id ${scoreId} not found`);
        }
        if (score.player.id !== playerId || score.song.id !== songId) {
            throw new BadRequestException(`Score ${scoreId} does not match the selected player and song`);
        }
        return score;
    }

    private async recalculateRoundIfComplete(match: Match, round: Match['rounds'][number]): Promise<void> {
        const matchPlayers = this.getSinglesPlayers(match);
        const isRoundCompleted = matchPlayers.every((player) =>
            round.standings.some(
                (standing) => standing.score.player.id === player.id && standing.score.song.id === round.song.id,
            ),
        );

        if (!isRoundCompleted) {
            return;
        }

        const scoreSystem = this.scoringSystemProvider.getScoringSystem(match.scoringSystem);
        scoreSystem.recalc(round.standings);

        for (const standing of round.standings) {
            const dto = new UpdateStandingDto();
            dto.points = standing.points;
            await this.standingService.update(standing.id, dto);
        }
    }

    private getSinglesPlayers(match: Match): Player[] {
        return (match.entrants ?? [])
            .filter((entrant) => entrant.type === 'player')
            .map((entrant) => entrant.participants?.[0]?.player)
            .filter(Boolean);
    }
}
