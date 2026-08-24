import { ConflictException, Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { AdvancementRule, Entrant } from "@tournament-manager/persistence";

import { MatchAggregate } from "@match/match.aggregate";
import { MatchStore } from "@match/match.store";
import { PhaseGroupStore } from "@tournament/structure/phase-group/phase-group.store";
import { AdvancementRuleStore } from "./advancement-rule.store";

type Impact = { rule: AdvancementRule; entrant: Entrant };
type BlockingTarget = {
    kind: "match" | "phase_group";
    id: number;
    name: string;
    reason: "RESULT_COMMITTED" | "SCORES_RECORDED";
    blockingMatchId?: number;
    blockingMatchName?: string;
};

type ProgressedPoolRow = {
    targetId: number;
    targetName: string;
    blockingMatchId: number;
    blockingMatchName: string;
    reason: "RESULT_COMMITTED" | "SCORES_RECORDED";
};

@Injectable()
export class AdvancementRollbackGuard {
    constructor(
        private readonly dataSource: DataSource,
        private readonly rules: AdvancementRuleStore,
        private readonly matches: MatchStore,
        private readonly phaseGroups: PhaseGroupStore,
    ) {}

    async assertMatchCanReopen(source: MatchAggregate): Promise<void> {
        const impacts = await this.impactsOf(source);
        const blockers = [...(await this.blockingMatches(impacts)), ...(await this.blockingPhaseGroups(impacts))];
        if (blockers.length === 0) {
            return;
        }

        throw new ConflictException({
            code: "ADVANCEMENT_ROLLBACK_BLOCKED_BY_TARGET_PROGRESS",
            message: "The result cannot be reopened because an affected advancement target already has scores or a committed result",
            sourceMatchId: source.id,
            blockingTargets: blockers,
        });
    }

    private async impactsOf(source: MatchAggregate): Promise<Impact[]> {
        const impacts = await this.impactsFromRules("match", source.id, source.entrantsByPlacement());
        const phaseGroup = await this.phaseGroups.load(source.phaseGroupId);
        if (phaseGroup?.entity.state === "completed") {
            impacts.push(...(await this.impactsFromRules("phase_group", phaseGroup.id, phaseGroup.placements)));
        }

        return impacts;
    }

    private async impactsFromRules(sourceKind: "match" | "phase_group", sourceId: number, placements: Entrant[]): Promise<Impact[]> {
        const rules = await this.rules.findBySource(sourceKind, sourceId);

        return rules.map((rule) => ({ rule, entrant: placements[rule.sourcePlacement - 1] })).filter((impact): impact is Impact => Boolean(impact.entrant));
    }

    private async blockingMatches(impacts: Impact[]): Promise<BlockingTarget[]> {
        const byTarget = this.groupByTarget(impacts.filter((impact) => impact.rule.targetKind === "match"));
        const blockers: BlockingTarget[] = [];
        for (const [targetId, targetImpacts] of byTarget) {
            const target = await this.matches.load(targetId);
            if (!target || !targetImpacts.some((impact) => target.entrants.some((entrant) => entrant.id === impact.entrant.id))) {
                continue;
            }
            if (target.poolState.completed) {
                blockers.push({ kind: "match", id: target.id, name: target.entity.name, reason: "RESULT_COMMITTED" });
            } else if (target.poolState.progressed) {
                blockers.push({ kind: "match", id: target.id, name: target.entity.name, reason: "SCORES_RECORDED" });
            }
        }

        return blockers;
    }

    private async blockingPhaseGroups(impacts: Impact[]): Promise<BlockingTarget[]> {
        const byTarget = this.groupByTarget(impacts.filter((impact) => impact.rule.targetKind === "phase_group"));
        const affectedIds: number[] = [];
        for (const [targetId, targetImpacts] of byTarget) {
            const target = await this.phaseGroups.load(targetId);
            if (target?.entity.entrants?.some((seat) => targetImpacts.some((impact) => seat.sourceAdvancementRule?.id === impact.rule.id))) {
                affectedIds.push(targetId);
            }
        }
        if (affectedIds.length === 0) {
            return [];
        }

        const rows: ProgressedPoolRow[] = await this.dataSource.query(
            `SELECT pg.id AS "targetId", pg.name AS "targetName", match.id AS "blockingMatchId",
                    match.name AS "blockingMatchName",
                    CASE WHEN match."matchResultId" IS NOT NULL THEN 'RESULT_COMMITTED' ELSE 'SCORES_RECORDED' END AS reason
             FROM phase_group pg
             JOIN match ON match."phaseGroupId" = pg.id
             WHERE pg.id = ANY($1::int[])
               AND (match."matchResultId" IS NOT NULL OR EXISTS (
                   SELECT 1 FROM round
                   JOIN standing ON standing."roundId" = round.id
                   WHERE round."matchId" = match.id AND (standing."scoreId" IS NOT NULL OR standing.points > 0)
               ))
             ORDER BY pg.id, match.id`,
            [affectedIds],
        );

        return rows.map((row) => ({
            kind: "phase_group",
            id: row.targetId,
            name: row.targetName,
            reason: row.reason,
            blockingMatchId: row.blockingMatchId,
            blockingMatchName: row.blockingMatchName,
        }));
    }

    private groupByTarget(impacts: Impact[]): Map<number, Impact[]> {
        const grouped = new Map<number, Impact[]>();
        for (const impact of impacts) {
            grouped.set(impact.rule.targetId, [...(grouped.get(impact.rule.targetId) ?? []), impact]);
        }

        return grouped;
    }
}
