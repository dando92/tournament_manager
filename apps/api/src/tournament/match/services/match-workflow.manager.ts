import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { CommitMatchResultDto, UpdateMatchActiveDto, UpdateMatchDto } from '@match/dtos/match.dto';
import { Match, MatchResultEntry } from '@tournament-manager/persistence';
import { MatchResultService } from '@match/services/match-result.service';
import { MatchService } from '@match/services/match.service';
import { AdvancementManager } from '@match/services/advancement.manager';
import { StartggService } from '../../../integrations/startgg/startgg.service';

@Injectable()
export class MatchWorkflowManager {
    constructor(
        @Inject()
        private readonly matchService: MatchService,
        @Inject()
        private readonly matchResultService: MatchResultService,
        @Inject()
        private readonly advancementManager: AdvancementManager,
        @Inject()
        private readonly startggService: StartggService,
    ) {}

    async UpdateMatchActive(matchId: number, dto: UpdateMatchActiveDto): Promise<Match> {
        const match = await this.matchService.getMatch(matchId);
        if (!match) throw new Error(`Match ${matchId} not found`);
        if (dto.active && match.matchResult) {
            throw new BadRequestException('Completed matches must be re-opened before activation');
        }

        return await this.matchService.updateActive(matchId, dto.active);
    }

    async CommitMatchResult(matchId: number, dto: CommitMatchResultDto): Promise<Match> {
        const match = await this.matchService.getMatch(matchId);
        if (!match) throw new Error(`Match ${matchId} not found`);

        const playerPoints = this.resolvePlayerPoints(match, dto);
        if (!playerPoints) {
            throw new BadRequestException(`Match ${match.id} cannot be completed because not all standings are populated`);
        }

        if (match.matchResult) {
            await this.advancementManager.RevertAdvancementFromMatch(match);
        }

        match.matchResult = await this.matchResultService.upsertForMatch(match.id, playerPoints);
        if (match.active) {
            await this.matchService.updateActive(match.id, false);
            match.active = false;
        }

        await this.advancementManager.AdvanceFromCompletedMatch(match);
        await this.startggService.reportCompletedMatch(match.id);
        return await this.matchService.getMatch(match.id);
    }

    async ReopenMatchResult(matchId: number): Promise<Match> {
        const match = await this.matchService.getMatch(matchId);
        if (!match) throw new Error(`Match ${matchId} not found`);

        if (match.matchResult) {
            await this.advancementManager.RevertAdvancementFromMatch(match);
            await this.matchResultService.deleteForMatch(match.id);
            match.matchResult = null;
        }

        if (match.active) {
            await this.matchService.updateActive(match.id, false);
            match.active = false;
        }

        return await this.matchService.getMatch(match.id);
    }

    async AddEntrantInMatch(matchId: number, entrantId: number): Promise<void> {
        const match = await this.matchService.getMatch(matchId);
        if (!match) return;
        this.assertEditable(match);
        if ((match.entrants ?? []).some(entrant => entrant.id === entrantId)) return;

        const dto = new UpdateMatchDto();
        dto.entrantIds = [...(match.entrants ?? []).map(entrant => entrant.id), entrantId];
        await this.matchService.update(matchId, dto);
    }

    async RemoveEntrantInMatch(matchId: number, entrantId: number): Promise<void> {
        const match = await this.matchService.getMatch(matchId);
        if (!match) return;
        this.assertEditable(match);

        const dto = new UpdateMatchDto();
        dto.entrantIds = (match.entrants ?? []).filter(entrant => entrant.id !== entrantId).map(entrant => entrant.id);
        await this.matchService.update(matchId, dto);
    }

    assertEditable(match: Match): void {
        if (match.matchResult) {
            throw new BadRequestException('Completed matches do not allow editing');
        }
    }

    private resolvePlayerPoints(match: Match, dto: CommitMatchResultDto): MatchResultEntry[] | null {
        if ((match.rounds?.length ?? 0) === 0) {
            return this.normalizeManualPlayerPoints(match, dto.playerPoints ?? []);
        }

        return this.buildMatchResultPlayerPoints(match);
    }

    private normalizeManualPlayerPoints(match: Match, playerPoints: MatchResultEntry[]): MatchResultEntry[] | null {
        const playerIds = new Set(this.getSinglesPlayerIds(match));
        const normalized = playerPoints
            .filter((entry) => playerIds.has(entry.playerId))
            .map((entry) => ({
                playerId: entry.playerId,
                points: Number(entry.points) || 0,
            }));

        if (normalized.length === 0 || normalized.every((entry) => entry.points <= 0)) {
            return null;
        }

        return normalized.sort((left, right) => right.points - left.points || left.playerId - right.playerId);
    }

    private buildMatchResultPlayerPoints(match: Match): MatchResultEntry[] | null {
        const playerIds = this.getSinglesPlayerIds(match);
        if (playerIds.length === 0 || (match.rounds?.length ?? 0) === 0) {
            return null;
        }

        const everyStandingPresent = (match.rounds ?? []).every((round) =>
            playerIds.every((playerId) =>
                (round.standings ?? []).some((standing) => standing.score.player.id === playerId),
            ),
        );
        if (!everyStandingPresent) {
            return null;
        }

        const playerPoints = playerIds.map((playerId) => ({
            playerId,
            points: (match.rounds ?? []).reduce((acc, round) => {
                const standing = (round.standings ?? []).find((candidate) => candidate.score.player.id === playerId);
                return acc + (standing?.points ?? 0);
            }, 0),
        }));

        return playerPoints.sort((left, right) => right.points - left.points || left.playerId - right.playerId);
    }

    private getSinglesPlayerIds(match: Match): number[] {
        return (match.entrants ?? [])
            .filter((entrant) => entrant.type === 'player')
            .map((entrant) => entrant.participants?.[0]?.player?.id)
            .filter((playerId): playerId is number => Number.isFinite(playerId));
    }
}
