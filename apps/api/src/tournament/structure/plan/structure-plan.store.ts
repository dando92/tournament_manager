import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { PlanNode, StructurePlan } from '@tournament-manager/contracts';
import { isScoringSystemType } from '@tournament-manager/scoring';
import {
    AdvancementRule,
    Division,
    ExternalMapping,
    type ExternalMappingExternalType,
    type ExternalMappingLocalType,
    Match,
    Phase,
    PhaseGroup,
    Tournament,
} from '@tournament-manager/persistence';
import { DataSource, EntityManager, In } from 'typeorm';

/** What the applier hands back: every node's row, and the divisions it moved. */
export type AppliedPlan = {
    rowIdByLocalId: Record<string, number>;
    divisionIds: number[];
};

const LOCAL_TYPE_OF: Record<string, ExternalMappingLocalType> = {
    division: 'division',
    phase: 'phase',
    phaseGroup: 'phaseGroup',
    match: 'match',
};

/**
 * Writing a plan, once.
 *
 * Everything happens in one transaction, which is the reason this exists at all:
 * generation used to write a match, then a rule, then the next match, so a
 * failure halfway left a bracket that was neither the old shape nor the new one.
 * A plan either lands whole or does not land.
 *
 * It does not go through the command layer. A command loads an aggregate, saves
 * it and publishes an event, which is right for one change a person made and
 * wrong for ninety: the same plan would publish ninety events and open ninety
 * transactions. One event is published by the caller when this returns.
 */
@Injectable()
export class StructurePlanStore {
    constructor(private readonly dataSource: DataSource) {}

    async apply(tournamentId: number, plan: StructurePlan, ordered: PlanNode[]): Promise<AppliedPlan> {
        return this.dataSource.transaction(async (manager) => {
            const tournament = await manager.findOneBy(Tournament, { id: tournamentId });
            if (!tournament) {
                throw new NotFoundException(`Tournament ${tournamentId} not found`);
            }

            const rowIdByLocalId: Record<string, number> = {};
            const divisionIds = new Set<number>();
            const created: PlanNode[] = [];

            for (const node of ordered) {
                if (node.action === 'skip') {
                    continue;
                }
                if (node.action === 'link') {
                    rowIdByLocalId[node.localId] = await this.assertLinkable(manager, node, tournamentId);
                    continue;
                }

                rowIdByLocalId[node.localId] = await this.create(manager, node, rowIdByLocalId, tournament);
                created.push(node);
            }

            for (const node of ordered) {
                const divisionId = await this.divisionOf(manager, node, rowIdByLocalId);
                if (divisionId) {
                    divisionIds.add(divisionId);
                }
            }

            await this.writeRoutes(manager, plan, rowIdByLocalId);
            await this.writeMappings(manager, created, rowIdByLocalId);

            for (const divisionId of divisionIds) {
                await manager.increment(Division, { id: divisionId }, 'structureVersion', 1);
            }

            return { rowIdByLocalId, divisionIds: [...divisionIds] };
        });
    }

    /**
     * A linked node names a row, and the row has to be here and has to be part
     * of this tournament. A plan built somewhere else could otherwise reach into
     * a tournament its author cannot see.
     */
    private async assertLinkable(manager: EntityManager, node: PlanNode, tournamentId: number): Promise<number> {
        const rowId = node.localRowId!;
        const found = await this.tournamentOf(manager, node, rowId);

        if (found === null) {
            throw new NotFoundException(`${node.kind} ${rowId}, which ${node.localId} links to, does not exist`);
        }
        if (found !== tournamentId) {
            throw new BadRequestException(`${node.kind} ${rowId}, which ${node.localId} links to, belongs to another tournament`);
        }

        return rowId;
    }

    private async tournamentOf(manager: EntityManager, node: PlanNode, rowId: number): Promise<number | null> {
        if (node.kind === 'division') {
            const division = await manager.findOne(Division, { where: { id: rowId }, relations: { tournament: true } });

            return division ? (division.tournament?.id ?? null) : null;
        }
        if (node.kind === 'phase') {
            const phase = await manager.findOne(Phase, { where: { id: rowId }, relations: { division: { tournament: true } } });

            return phase ? (phase.division?.tournament?.id ?? null) : null;
        }
        if (node.kind === 'phaseGroup') {
            const phaseGroup = await manager.findOne(PhaseGroup, {
                where: { id: rowId },
                relations: { phase: { division: { tournament: true } } },
            });

            return phaseGroup ? (phaseGroup.phase?.division?.tournament?.id ?? null) : null;
        }
        if (node.kind === 'match') {
            const match = await manager.findOne(Match, {
                where: { id: rowId },
                relations: { phaseGroup: { phase: { division: { tournament: true } } } },
            });

            return match ? (match.phaseGroup?.phase?.division?.tournament?.id ?? null) : null;
        }

        throw new BadRequestException(`A ${node.kind} cannot be written from a structure plan yet.`);
    }

    private async create(manager: EntityManager, node: PlanNode, rowIdByLocalId: Record<string, number>, tournament: Tournament): Promise<number> {
        const parentRowId = node.parentLocalId ? rowIdByLocalId[node.parentLocalId] : undefined;
        const name = node.name.trim();

        if (node.kind === 'division') {
            const division = manager.create(Division, { name, tournament, phases: [], entrants: [] });

            return (await manager.save(Division, division)).id;
        }
        if (node.kind === 'phase') {
            const division = await manager.findOneBy(Division, { id: parentRowId! });
            const phase = manager.create(Phase, { name, division: division!, phaseGroups: [] });

            return (await manager.save(Phase, phase)).id;
        }
        if (node.kind === 'phaseGroup') {
            const phase = await manager.findOneBy(Phase, { id: parentRowId! });
            const phaseGroup = manager.create(PhaseGroup, { name, phase: phase!, bracketType: node.bracketType ?? null });

            return (await manager.save(PhaseGroup, phaseGroup)).id;
        }
        if (node.kind === 'match') {
            const phaseGroup = await manager.findOneBy(PhaseGroup, { id: parentRowId! });
            const asked = node.scoringSystem ?? '';
            const match = manager.create(Match, {
                name,
                notes: node.subtitle ?? '',
                phaseGroup: phaseGroup!,
                scoringSystem: isScoringSystemType(asked) ? asked : tournament.defaultScoringSystem,
            });

            return (await manager.save(Match, match)).id;
        }

        throw new BadRequestException(`A ${node.kind} cannot be written from a structure plan yet.`);
    }

    /** Which division a node moved, so its structure version follows the write. */
    private async divisionOf(manager: EntityManager, node: PlanNode, rowIdByLocalId: Record<string, number>): Promise<number | null> {
        const rowId = rowIdByLocalId[node.localId];
        if (!rowId) {
            return null;
        }
        if (node.kind === 'division') {
            return rowId;
        }
        if (node.kind === 'phase') {
            const phase = await manager.findOne(Phase, { where: { id: rowId }, relations: { division: true } });

            return phase?.division?.id ?? null;
        }
        if (node.kind === 'phaseGroup') {
            const phaseGroup = await manager.findOne(PhaseGroup, { where: { id: rowId }, relations: { phase: { division: true } } });

            return phaseGroup?.phase?.division?.id ?? null;
        }
        if (node.kind === 'match') {
            const match = await manager.findOne(Match, {
                where: { id: rowId },
                relations: { phaseGroup: { phase: { division: true } } },
            });

            return match?.phaseGroup?.phase?.division?.id ?? null;
        }

        return null;
    }

    /**
     * The routes the plan drew, as advancement rules.
     *
     * A slot a rule already claims is replaced rather than doubled, because two
     * rules filling one slot is the ambiguity the canvas refuses to draw and the
     * database has never refused to hold.
     */
    private async writeRoutes(manager: EntityManager, plan: StructurePlan, rowIdByLocalId: Record<string, number>): Promise<void> {
        const kindOf = new Map(plan.nodes.map((node) => [node.localId, node.kind]));
        const rules: AdvancementRule[] = [];

        for (const route of plan.routes) {
            const sourceId = rowIdByLocalId[route.sourceLocalId];
            const targetId = rowIdByLocalId[route.targetLocalId];
            if (!sourceId || !targetId) {
                continue;
            }

            const targetKind = kindOf.get(route.targetLocalId) === 'match' ? 'match' : 'phase_group';
            await manager.delete(AdvancementRule, { targetKind, targetId, targetSlot: route.targetSlot });

            rules.push(
                manager.create(AdvancementRule, {
                    sourceKind: kindOf.get(route.sourceLocalId) === 'match' ? 'match' : 'phase_group',
                    sourceId,
                    sourcePlacement: route.sourcePlacement,
                    targetKind,
                    targetId,
                    targetSlot: route.targetSlot,
                }),
            );
        }

        if (rules.length > 0) {
            await manager.save(AdvancementRule, rules);
        }
    }

    /**
     * What the plan created, remembered under the identity it came from.
     *
     * Without this a second import of the same event links nothing and builds
     * the whole structure again beside the first one.
     */
    private async writeMappings(manager: EntityManager, created: PlanNode[], rowIdByLocalId: Record<string, number>): Promise<void> {
        const mappings = created
            .filter((node) => node.external && LOCAL_TYPE_OF[node.kind])
            .map((node) =>
                manager.create(ExternalMapping, {
                    provider: node.external!.provider,
                    localType: LOCAL_TYPE_OF[node.kind],
                    localId: String(rowIdByLocalId[node.localId]),
                    externalType: node.external!.externalType as ExternalMappingExternalType,
                    externalId: node.external!.externalId,
                }),
            );

        if (mappings.length === 0) {
            return;
        }

        /* The identity is unique now, so a mapping already there is left alone
           rather than colliding: applying the same plan twice is not an error. */
        const existing = await manager.find(ExternalMapping, {
            where: { externalId: In(mappings.map((mapping) => mapping.externalId)) },
        });
        const known = new Set(existing.map((mapping) => this.identityOf(mapping)));

        const fresh = mappings.filter((mapping) => !known.has(this.identityOf(mapping)));
        if (fresh.length > 0) {
            await manager.save(ExternalMapping, fresh);
        }
    }

    private identityOf(mapping: ExternalMapping): string {
        return [mapping.provider, mapping.localType, mapping.localId, mapping.externalType, mapping.externalId].join('|');
    }
}
