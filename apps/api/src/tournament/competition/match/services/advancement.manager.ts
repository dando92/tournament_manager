import { Inject, Injectable } from '@nestjs/common';
import { AdvancementRule, Entrant, Match } from '@tournament-manager/persistence';

import { MatchAggregate } from '@match/match.aggregate';
import { MatchStore } from '@match/match.store';
import { UiUpdatePublisher } from '@match/services/ui-update.publisher';
import { AdvancementRuleService } from '@tournament/structure/services/advancement-rule.service';
import { PhaseGroupService } from '@tournament/structure/services/phase-group.service';

/**
 * Where the entrants of a finished match go next.
 *
 * A committed result places them, reopening it takes the placement back, and a
 * pool whose last match is in does the same thing one level up. Both directions
 * read the same rules and walk them the same way, which is why they differ only
 * in what they do to the target.
 */
@Injectable()
export class AdvancementManager {
    constructor(
        @Inject()
        private readonly matches: MatchStore,
        @Inject()
        private readonly advancementRules: AdvancementRuleService,
        @Inject()
        private readonly phaseGroups: PhaseGroupService,
        @Inject()
        private readonly publisher: UiUpdatePublisher,
    ) {}

    async advanceFromMatch(match: MatchAggregate): Promise<void> {
        await this.applyRules('match', match.id, match.entrantsByPlacement(), 'place');
        await this.updatePhaseGroupCompletion(match.phaseGroupId);
    }

    async revertFromMatch(match: MatchAggregate): Promise<void> {
        await this.applyRules('match', match.id, match.entrantsByPlacement(), 'remove');
        await this.revertPhaseGroupCompletion(match.phaseGroupId);
    }

    /**
     * One walk over the rules that leave a competition, in both directions.
     *
     * The entrants arrive already ordered by the placement they earned, so a
     * rule is a lookup by index into that order and nothing more.
     */
    private async applyRules(
        sourceKind: 'match' | 'phase_group',
        sourceId: number,
        placements: Entrant[],
        direction: 'place' | 'remove',
    ): Promise<Entrant[]> {
        const rules = await this.advancementRules.findBySource(sourceKind, sourceId);
        const moved: Entrant[] = [];

        for (const rule of rules) {
            const entrant = placements[rule.sourcePlacement - 1];
            if (!entrant) continue;
            moved.push(entrant);

            if (rule.targetKind === 'match') {
                await this.writeTargetMatch(rule, entrant, direction);
            }
            if (rule.targetKind === 'phase_group') {
                if (direction === 'place') await this.phaseGroups.addEntrant(rule.targetId, entrant.id, rule.targetSlot, rule.id);
                else await this.phaseGroups.removeEntrant(rule.targetId, entrant.id);
            }
        }

        return moved;
    }

    private async writeTargetMatch(rule: AdvancementRule, entrant: Entrant, direction: 'place' | 'remove'): Promise<void> {
        const target = await this.matches.load(rule.targetId);
        if (!target) return;

        if (direction === 'place') target.placeEntrant(entrant, rule.targetSlot);
        else if (!target.removeEntrant(entrant.id)) return;

        await this.matches.save(target);
        await this.phaseGroups.syncDerivedEntrants(target.phaseGroupId);
        await this.publisher.emitMatchUpdate(target.address);
        /* Who is in a match decides whether it is waiting on anyone, so placing
           an entrant moves the counts of the pool it landed in. */
        await this.publisher.emitPhaseGroupUpdate(target.address);
    }

    /**
     * A pool is finished when every match in it is, and a finished pool places
     * its own entrants through the rules that leave it.
     */
    private async updatePhaseGroupCompletion(phaseGroupId: number): Promise<void> {
        if (!phaseGroupId) return;

        const phaseGroup = await this.phaseGroups.findOne(phaseGroupId);
        if (!phaseGroup || (phaseGroup.matches?.length ?? 0) === 0) return;
        if (!(phaseGroup.matches ?? []).every((candidate) => Boolean(candidate.matchResult))) return;

        const placements = this.phaseGroupPlacements(phaseGroup.matches);
        const advanced = await this.applyRules('phase_group', phaseGroupId, placements, 'place');

        await this.phaseGroups.markEntrantsAdvanced(phaseGroupId, advanced.map((entrant) => entrant.id));
        await this.phaseGroups.update(phaseGroupId, { state: 'completed' });
    }

    private async revertPhaseGroupCompletion(phaseGroupId: number): Promise<void> {
        if (!phaseGroupId) return;

        const phaseGroup = await this.phaseGroups.findOne(phaseGroupId);
        if (!phaseGroup) return;

        const placements = this.phaseGroupPlacements(phaseGroup.matches ?? []);
        await this.applyRules('phase_group', phaseGroupId, placements, 'remove');

        await this.phaseGroups.markEntrantsAdvanced(phaseGroupId, []);
        await this.phaseGroups.update(phaseGroupId, { state: 'active' });
    }

    /** The standings of a pool: every entrant by the points its matches gave it. */
    private phaseGroupPlacements(matches: Match[]): Entrant[] {
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
}
