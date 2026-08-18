import { Inject, Injectable } from '@nestjs/common';
import { UpdateMatchDto } from '@match/dtos/match.dto';
import { AdvancementRule, Entrant, Match } from '@persistence/entities';
import { UiUpdateGateway } from '@match/gateways/ui-update.gateway';
import { MatchService } from '@match/services/match.service';
import { AdvancementRuleService } from '@tournament/services/advancement-rule.service';
import { PhaseGroupService } from '@tournament/services/phase-group.service';

@Injectable()
export class AdvancementManager {
    constructor(
        @Inject()
        private readonly matchService: MatchService,
        @Inject()
        private readonly advancementRuleService: AdvancementRuleService,
        @Inject()
        private readonly phaseGroupService: PhaseGroupService,
        @Inject()
        private readonly uiUpdateGateway: UiUpdateGateway,
    ) {}

    async AdvanceFromCompletedMatch(match: Match): Promise<void> {
        const advancementRules = await this.advancementRuleService.findBySource('match', match.id);
        if (advancementRules.length > 0) {
            await this.advanceEntrantsFromMatchResult(match, advancementRules);
            await this.emitTargetMatchUpdates(advancementRules);
        }
        await this.updatePhaseGroupCompletion(match);
    }

    async RevertAdvancementFromMatch(match: Match): Promise<void> {
        const advancementRules = await this.advancementRuleService.findBySource('match', match.id);
        if (advancementRules.length > 0) {
            await this.revertEntrantsFromMatchResult(match, advancementRules);
            await this.emitTargetMatchUpdates(advancementRules);
        }
        await this.revertPhaseGroupCompletion(match);
    }

    private async advanceEntrantsFromMatchResult(match: Match, advancementRules: AdvancementRule[]): Promise<void> {
        const sortedEntrants = this.sortEntrantsByMatchResult(match);
        for (const rule of advancementRules) {
            const entrant = sortedEntrants[rule.sourcePlacement - 1];
            if (!entrant) continue;
            if (rule.targetKind === 'match') {
                await this.placeEntrantInMatchSlot(rule.targetId, entrant.id, rule.targetSlot);
            }
            if (rule.targetKind === 'phase_group') {
                await this.phaseGroupService.addEntrant(rule.targetId, entrant.id, rule.targetSlot, rule.id);
            }
        }
    }

    private async revertEntrantsFromMatchResult(match: Match, advancementRules: AdvancementRule[]): Promise<void> {
        const sortedEntrants = this.sortEntrantsByMatchResult(match);
        for (const rule of advancementRules) {
            const entrant = sortedEntrants[rule.sourcePlacement - 1];
            if (!entrant) continue;
            if (rule.targetKind === 'match') {
                await this.removeEntrantInMatch(rule.targetId, entrant.id);
            }
            if (rule.targetKind === 'phase_group') {
                await this.phaseGroupService.removeEntrant(rule.targetId, entrant.id);
            }
        }
    }

    private async updatePhaseGroupCompletion(match: Match): Promise<void> {
        const phaseGroupId = match.phaseGroup?.id;
        if (!phaseGroupId) return;

        const phaseGroup = await this.phaseGroupService.findOne(phaseGroupId);
        if (!phaseGroup || (phaseGroup.matches?.length ?? 0) === 0) return;
        if (!(phaseGroup.matches ?? []).every((candidate) => Boolean(candidate.matchResult))) return;

        const placements = this.calculatePhaseGroupPlacements(phaseGroup.matches);
        const rules = await this.advancementRuleService.findBySource('phase_group', phaseGroupId);
        const advancedEntrantIds: number[] = [];

        for (const rule of rules) {
            const entrant = placements[rule.sourcePlacement - 1];
            if (!entrant) continue;
            advancedEntrantIds.push(entrant.id);
            if (rule.targetKind === 'phase_group') {
                await this.phaseGroupService.addEntrant(rule.targetId, entrant.id, rule.targetSlot, rule.id);
            }
            if (rule.targetKind === 'match') {
                await this.placeEntrantInMatchSlot(rule.targetId, entrant.id, rule.targetSlot);
            }
        }

        await this.phaseGroupService.markEntrantsAdvanced(phaseGroupId, advancedEntrantIds);
        await this.phaseGroupService.update(phaseGroupId, { state: 'completed' });
    }

    private async revertPhaseGroupCompletion(match: Match): Promise<void> {
        const phaseGroupId = match.phaseGroup?.id;
        if (!phaseGroupId) return;

        const phaseGroup = await this.phaseGroupService.findOne(phaseGroupId);
        if (!phaseGroup) return;

        const placements = this.calculatePhaseGroupPlacements(phaseGroup.matches ?? []);
        const rules = await this.advancementRuleService.findBySource('phase_group', phaseGroupId);
        for (const rule of rules) {
            const entrant = placements[rule.sourcePlacement - 1];
            if (!entrant) continue;
            if (rule.targetKind === 'phase_group') {
                await this.phaseGroupService.removeEntrant(rule.targetId, entrant.id);
            }
            if (rule.targetKind === 'match') {
                await this.removeEntrantInMatch(rule.targetId, entrant.id);
            }
        }

        await this.phaseGroupService.markEntrantsAdvanced(phaseGroupId, []);
        await this.phaseGroupService.update(phaseGroupId, { state: 'active' });
    }

    private calculatePhaseGroupPlacements(matches: Match[]): Entrant[] {
        const pointsByEntrantId = new Map<number, number>();
        const entrantsById = new Map<number, Entrant>();

        for (const match of matches) {
            const pointsByPlayerId = new Map((match.matchResult?.playerPoints ?? []).map((entry) => [entry.playerId, entry.points]));
            for (const entrant of match.entrants ?? []) {
                const playerId = entrant.participants?.[0]?.player?.id;
                entrantsById.set(entrant.id, entrant);
                pointsByEntrantId.set(entrant.id, (pointsByEntrantId.get(entrant.id) ?? 0) + (pointsByPlayerId.get(playerId) ?? 0));
            }
        }

        return Array.from(entrantsById.values()).sort((left, right) =>
            (pointsByEntrantId.get(right.id) ?? 0) - (pointsByEntrantId.get(left.id) ?? 0) || left.id - right.id,
        );
    }

    private async placeEntrantInMatchSlot(matchId: number, entrantId: number, targetSlot: number): Promise<void> {
        const match = await this.matchService.getMatch(matchId);
        if (!match) return;

        const targetIndex = Math.max(targetSlot - 1, 0);
        const entrantIds = (match.entrants ?? [])
            .map(entrant => entrant.id)
            .filter(id => id !== entrantId);

        if (targetIndex >= entrantIds.length) {
            entrantIds.push(entrantId);
        } else {
            entrantIds.splice(targetIndex, 0, entrantId);
        }

        const dto = new UpdateMatchDto();
        dto.entrantIds = entrantIds;
        await this.matchService.update(matchId, dto);
    }

    private async removeEntrantInMatch(matchId: number, entrantId: number): Promise<void> {
        const match = await this.matchService.getMatch(matchId);
        if (!match) return;

        const dto = new UpdateMatchDto();
        dto.entrantIds = (match.entrants ?? [])
            .filter(entrant => entrant.id !== entrantId)
            .map(entrant => entrant.id);
        await this.matchService.update(matchId, dto);
    }

    private async emitTargetMatchUpdates(advancementRules: AdvancementRule[]): Promise<void> {
        const targetMatchIds = Array.from(new Set(
            advancementRules
                .filter(rule => rule.targetKind === 'match')
                .map(rule => rule.targetId),
        ));

        for (const targetMatchId of targetMatchIds) {
            const targetMatch = await this.matchService.getMatch(targetMatchId);
            if (targetMatch) {
                await this.uiUpdateGateway.emitMatchUpdateByMatchId(targetMatch.id);
            }
        }
    }

    private sortEntrantsByMatchResult(match: Match): Entrant[] {
        const playerPoints = new Map(
            (match.matchResult?.playerPoints ?? []).map((entry) => [entry.playerId, entry.points]),
        );

        return [...(match.entrants ?? [])].sort((left, right) => {
            const leftPlayerId = left.participants?.[0]?.player?.id;
            const rightPlayerId = right.participants?.[0]?.player?.id;
            return (playerPoints.get(rightPlayerId) ?? 0) - (playerPoints.get(leftPlayerId) ?? 0);
        });
    }
}
