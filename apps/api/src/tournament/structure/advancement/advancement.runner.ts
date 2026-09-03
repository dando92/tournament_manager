import { Inject, Injectable } from '@nestjs/common';
import { AdvancementRule, Entrant } from '@tournament-manager/persistence';
import { ScoringSystemProvider } from '@tournament-manager/scoring';

import { MatchAggregate } from '@match/match.aggregate';
import { MatchStore } from '@match/match.store';
import { UiUpdatePublisher } from '@tournament/shared/ui-update.publisher';
import { AdvancementRuleStore } from './advancement-rule.store';
import { PhaseGroupStore } from '@tournament/structure/phase-group/phase-group.store';
import { ScheduleRunner } from '@tournament/competition/schedule/schedule.runner';

/** The entrants one rule moves into one pool. */
type PoolPlacement = {
    rule: AdvancementRule;
    entrant: Entrant;
};

/**
 * Where the entrants of a finished match go next.
 *
 * A committed result places them, reopening it takes the placement back, and a
 * pool whose last match is in does the same thing one level up. Both directions
 * read the same rules and walk them the same way, which is why they differ only
 * in what they do to the target.
 *
 * This is the one place a write to one aggregate changes another, because that
 * is what an advancement rule is: an edge between two competitions. It works
 * through the two stores and the aggregates they load rather than through
 * either commands class, so a target is loaded once however many rules point at
 * it, and announced once.
 */
@Injectable()
export class AdvancementRunner {
    constructor(
        @Inject()
        private readonly matches: MatchStore,
        @Inject()
        private readonly advancementRules: AdvancementRuleStore,
        @Inject()
        private readonly phaseGroups: PhaseGroupStore,
        @Inject()
        private readonly publisher: UiUpdatePublisher,
        @Inject()
        private readonly scoringSystems: ScoringSystemProvider,
        private readonly controlRoom: ScheduleRunner,
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
     * rule is a lookup by index into that order and nothing more. The rules that
     * end in a pool are collected first and written per pool, because four
     * entrants moving into one pool are one change to it.
     */
    private async applyRules(
        sourceKind: 'match' | 'phase_group',
        sourceId: number,
        placements: Entrant[],
        direction: 'place' | 'remove',
    ): Promise<Entrant[]> {
        const rules = await this.advancementRules.findBySource(sourceKind, sourceId);
        const moved: Entrant[] = [];
        const byPool = new Map<number, PoolPlacement[]>();

        for (const rule of rules) {
            const entrant = placements[rule.sourcePlacement - 1];
            if (!entrant) continue;
            moved.push(entrant);

            if (rule.targetKind === 'match') {
                await this.writeTargetMatch(rule, entrant, direction);
            }
            if (rule.targetKind === 'phase_group') {
                byPool.set(rule.targetId, [...(byPool.get(rule.targetId) ?? []), { rule, entrant }]);
            }
        }

        for (const [phaseGroupId, placementsInPool] of byPool) {
            await this.writeTargetPool(phaseGroupId, placementsInPool, direction);
        }

        return moved;
    }

    private async writeTargetMatch(rule: AdvancementRule, entrant: Entrant, direction: 'place' | 'remove'): Promise<void> {
        const target = await this.matches.load(rule.targetId);
        if (!target) return;

        if (direction === 'place') target.placeEntrant(entrant, rule.targetSlot, this.scoringSystems);
        else if (!target.removeEntrant(entrant.id, this.scoringSystems)) return;

        await this.matches.save(target);
        await this.controlRoom.recalculateForMatch(target.id);
        await this.publisher.emitMatchUpdate(target.address);
        /* Who is in a match decides whether it is waiting on anyone, so placing
           an entrant moves the counts of the pool it landed in. */
        await this.publisher.emitPhaseGroupUpdate(target.address);
    }

    private async writeTargetPool(phaseGroupId: number, placements: PoolPlacement[], direction: 'place' | 'remove'): Promise<void> {
        const phaseGroup = await this.phaseGroups.load(phaseGroupId);
        if (!phaseGroup) return;

        for (const { rule, entrant } of placements) {
            if (direction === 'place') phaseGroup.place({ entrant, slot: rule.targetSlot, sourceAdvancementRuleId: rule.id });
            else phaseGroup.release(entrant.id);
        }

        await this.phaseGroups.save(phaseGroup);
        await this.publisher.emitPhaseGroupUpdate(phaseGroup.address);
    }

    /**
     * A pool is finished when every match in it is, and a finished pool places
     * its own entrants through the rules that leave it.
     *
     * Marking who advanced and closing the pool are two changes to the same
     * aggregate, so they are one save and one event; they used to be a save per
     * seat, then a second load of the pool to write its state.
     */
    private async updatePhaseGroupCompletion(phaseGroupId: number): Promise<void> {
        if (!phaseGroupId) return;

        const phaseGroup = await this.phaseGroups.load(phaseGroupId);
        if (!phaseGroup?.isDecided) return;

        const advanced = await this.applyRules('phase_group', phaseGroupId, phaseGroup.placements, 'place');
        phaseGroup.markAdvanced(advanced.map((entrant) => entrant.id));
        phaseGroup.complete();

        await this.phaseGroups.save(phaseGroup);
        await this.publisher.emitPhaseGroupUpdate(phaseGroup.address);
    }

    private async revertPhaseGroupCompletion(phaseGroupId: number): Promise<void> {
        if (!phaseGroupId) return;

        const phaseGroup = await this.phaseGroups.load(phaseGroupId);
        if (!phaseGroup) return;

        await this.applyRules('phase_group', phaseGroupId, phaseGroup.placements, 'remove');
        phaseGroup.markAdvanced([]);
        phaseGroup.reopen();

        await this.phaseGroups.save(phaseGroup);
        await this.publisher.emitPhaseGroupUpdate(phaseGroup.address);
    }
}
