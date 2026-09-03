import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
    AdvancementRuleDto,
    DivisionPhaseDto,
    DivisionSummaryDto,
    PhaseGroupDto,
    PhaseGroupState,
    TournamentOverviewDto,
} from '@tournament-manager/contracts';

/**
 * How much of the structure a projection covers. The three read scopes differ
 * in this and in nothing else, so they share one query and one mapper.
 */
type TreeScope = 'tournament' | 'division' | 'phaseGroup';

const SCOPE_PREDICATE: Record<TreeScope, string> = {
    tournament: 'd."tournamentId" = $1',
    division: 'd."id" = $1',
    phaseGroup: 'pg."id" = $1',
};

/**
 * The rows `STRUCTURE_IN_SCOPE` produces: one per pool, carrying the division and
 * phase it hangs from. Changing one without the other is a bug.
 *
 * A division with no phases and a phase with no pools still appear, with nulls
 * from the identifier onwards, because the tree draws an empty branch rather
 * than hiding it.
 */
type StructureRow = {
    divisionId: number;
    divisionName: string;
    divisionStructureVersion: number;
    phaseId: number | null;
    phaseName: string | null;
    phaseGroupId: number | null;
    phaseGroupName: string | null;
    displayIdentifier: string | null;
    bracketType: string | null;
    state: PhaseGroupState | null;
    matchCount: number;
};

const structureInScope = (predicate: string): string => `
    SELECT  d."id"                  AS "divisionId",
            d."name"                AS "divisionName",
            d."structureVersion"    AS "divisionStructureVersion",
            ph."id"                 AS "phaseId",
            ph."name"               AS "phaseName",
            pg."id"                 AS "phaseGroupId",
            pg."name"               AS "phaseGroupName",
            pg."displayIdentifier"  AS "displayIdentifier",
            pg."bracketType"        AS "bracketType",
            pg."state"              AS "state",
            COALESCE(matches."count", 0) AS "matchCount"
    FROM        "division" d
    LEFT JOIN   "phase" ph ON ph."divisionId" = d."id"
    LEFT JOIN   "phase_group" pg ON pg."phaseId" = ph."id"
    LEFT JOIN LATERAL (
        SELECT  COUNT(*)::int AS "count"
        FROM    "match" m
        WHERE   m."phaseGroupId" = pg."id"
    ) matches ON TRUE
    WHERE    ${predicate}
    ORDER BY d."id", ph."id", pg."id"
`;

/** One structure query per scope, built once at module load. */
const STRUCTURE_IN_SCOPE: Record<TreeScope, string> = {
    tournament: structureInScope(SCOPE_PREDICATE.tournament),
    division: structureInScope(SCOPE_PREDICATE.division),
    phaseGroup: structureInScope(SCOPE_PREDICATE.phaseGroup),
};

/** The rows `ENTRANT_COUNTS_IN_SCOPE` produces. */
type EntrantCountRow = {
    divisionId: number;
    entrantCount: number;
};

/**
 * Which divisions a scope covers, reached from the division itself rather than
 * from the pools below it.
 *
 * The structure query returns one row per pool, so a count carried in it is
 * recomputed once per pool of the same division. Joining the pools in here
 * instead would multiply each entrant by them, hence the pool scope resolves
 * its division first.
 */
const DIVISION_PREDICATE: Record<TreeScope, string> = {
    tournament: 'd."tournamentId" = $1',
    division: 'd."id" = $1',
    phaseGroup: `d."id" = (
        SELECT  ph."divisionId"
        FROM    "phase_group" pg
        JOIN    "phase" ph ON ph."id" = pg."phaseId"
        WHERE   pg."id" = $1
    )`,
};

/** How many entrants still compete in each division of the scope. */
const entrantCountsInScope = (predicate: string): string => `
    SELECT   d."id" AS "divisionId", COUNT(e."id")::int AS "entrantCount"
    FROM     "division" d
    JOIN     "entrant" e ON e."divisionId" = d."id" AND e."status" = 'active'
    WHERE    ${predicate}
    GROUP BY d."id"
`;

/** The same, per scope, built once at module load. */
const ENTRANT_COUNTS_IN_SCOPE: Record<TreeScope, string> = {
    tournament: entrantCountsInScope(DIVISION_PREDICATE.tournament),
    division: entrantCountsInScope(DIVISION_PREDICATE.division),
    phaseGroup: entrantCountsInScope(DIVISION_PREDICATE.phaseGroup),
};

/** The rows `MATCH_COUNTS_IN_SCOPE` produces, one per pool that holds a match. */
type MatchCountRow = {
    phaseGroupId: number;
    progressedMatchCount: number;
    pendingMatchCount: number;
};

/**
 * How far the matches of each pool have got, from the column that already
 * answers it.
 *
 * `match."state"` is written by `MatchStore` from `MatchAggregate.state`, so
 * neither count re-derives anything: progress is any state above `open`, and a
 * match waiting on a person is one settled but not committed, whether it can be
 * committed as it stands or is tied where the tie decides an advancement. The
 * two used to be a four-CTE walk over rounds, standings and the entrant join
 * tables, and a second pass over the same rows, in a read the whole tournament
 * holds open. See `PerformanceReadiness.md`, batch S.
 */
const matchCountsInScope = (predicate: string): string => `
    SELECT m."phaseGroupId" AS "phaseGroupId",
           COUNT(*) FILTER (WHERE m."state" <> 'open')::int AS "progressedMatchCount",
           COUNT(*) FILTER (WHERE m."state" IN ('ready', 'tiebreak_required'))::int AS "pendingMatchCount"
    FROM "match" m
    JOIN "phase_group" pg ON pg."id" = m."phaseGroupId"
    JOIN "phase" ph ON ph."id" = pg."phaseId"
    JOIN "division" d ON d."id" = ph."divisionId"
    WHERE ${predicate}
    GROUP BY m."phaseGroupId"
`;

/** One counts query per scope, built once at module load. */
const MATCH_COUNTS_IN_SCOPE: Record<TreeScope, string> = {
    tournament: matchCountsInScope(SCOPE_PREDICATE.tournament),
    division: matchCountsInScope(SCOPE_PREDICATE.division),
    phaseGroup: matchCountsInScope(SCOPE_PREDICATE.phaseGroup),
};

/** The rows `ADVANCEMENT_RULES_FROM_PHASE_GROUPS` produces. */
type AdvancementRuleRow = AdvancementRuleDto;

/** Where a set of pools sends its finishers, for all of them at once. */
const ADVANCEMENT_RULES_FROM_PHASE_GROUPS = `
    SELECT  ar."id"              AS "id",
            ar."sourceKind"      AS "sourceKind",
            ar."sourceId"        AS "sourceId",
            spg."name"           AS "sourceName",
            ar."sourcePlacement" AS "sourcePlacement",
            ar."targetKind"      AS "targetKind",
            ar."targetId"        AS "targetId",
            COALESCE(tm."name", tpg."name") AS "targetName",
            ar."targetSlot"      AS "targetSlot"
    FROM      "advancement_rule" ar
    LEFT JOIN "phase_group" spg ON spg."id" = ar."sourceId"
    LEFT JOIN "match" tm ON ar."targetKind" = 'match' AND tm."id" = ar."targetId"
    LEFT JOIN "phase_group" tpg ON ar."targetKind" = 'phase_group' AND tpg."id" = ar."targetId"
    WHERE    ar."sourceKind" = 'phase_group' AND ar."sourceId" = ANY($1::int[])
    ORDER BY ar."sourceId", ar."sourcePlacement", ar."targetSlot", ar."id"
`;

/**
 * The read that spans division, phase and pool.
 *
 * Three routes ask the same question of different amounts of the tree, so one
 * projection answers all three and each read costs three queries whatever its
 * scope holds: the structure, the match counts of every pool in it, and the
 * advancement rules of all of them together.
 *
 * It projects and nothing else: it does not write, does not publish, and does
 * not call a service.
 */
@Injectable()
export class TreeQueries {
    constructor(
        @InjectDataSource()
        private readonly dataSource: DataSource,
    ) {}

    async forTournament(tournamentId: number): Promise<TournamentOverviewDto> {
        const divisions = await this.inScope('tournament', tournamentId);

        return {
            divisionCount: divisions.length,
            playerCount: divisions.reduce((count, division) => count + division.entrantCount, 0),
            matchCount: divisions.reduce((count, division) => count + division.matchCount, 0),
            divisions,
        };
    }

    async forDivision(divisionId: number): Promise<DivisionSummaryDto | null> {
        const [division] = await this.inScope('division', divisionId);

        return division ?? null;
    }

    /** One node of the tree, for the pool mutations that answer with what they changed. */
    async phaseGroup(phaseGroupId: number): Promise<PhaseGroupDto | null> {
        const [division] = await this.inScope('phaseGroup', phaseGroupId);
        const phaseGroup = division?.phases[0]?.phaseGroups[0];

        return phaseGroup ?? null;
    }

    private async inScope(scope: TreeScope, id: number): Promise<DivisionSummaryDto[]> {
        const rows: StructureRow[] = await this.dataSource.query(STRUCTURE_IN_SCOPE[scope], [id]);
        if (rows.length === 0) return [];

        const [entrants, counts, rules] = await Promise.all([
            this.entrantCounts(scope, id),
            this.matchCounts(scope, id),
            this.advancementRulesOf(rows.map((row) => row.phaseGroupId).filter((value): value is number => value !== null)),
        ]);

        const divisions: DivisionSummaryDto[] = [];
        const phasesByDivision = new Map<number, Map<number, DivisionPhaseDto>>();

        for (const row of rows) {
            const division = this.divisionOf(divisions, phasesByDivision, row, entrants.get(row.divisionId) ?? 0);
            if (row.phaseId === null) continue;

            const phase = this.phaseOf(division, phasesByDivision.get(row.divisionId)!, row);
            if (row.phaseGroupId === null) continue;

            phase.phaseGroups.push({
                id: row.phaseGroupId,
                name: row.phaseGroupName ?? '',
                displayIdentifier: row.displayIdentifier,
                bracketType: row.bracketType,
                state: row.state!,
                matchCount: row.matchCount,
                progressedMatchCount: counts.get(row.phaseGroupId)?.progressed ?? 0,
                pendingMatchCount: counts.get(row.phaseGroupId)?.pending ?? 0,
                advancementRules: rules.get(row.phaseGroupId) ?? [],
            });
            phase.matchCount += row.matchCount;
            division.matchCount += row.matchCount;
        }

        return divisions;
    }

    private divisionOf(
        divisions: DivisionSummaryDto[],
        phasesByDivision: Map<number, Map<number, DivisionPhaseDto>>,
        row: StructureRow,
        entrantCount: number,
    ): DivisionSummaryDto {
        const existing = divisions.find((division) => division.id === row.divisionId);
        if (existing) return existing;

        const division: DivisionSummaryDto = {
            id: row.divisionId,
            name: row.divisionName,
            structureVersion: row.divisionStructureVersion,
            entrantCount,
            matchCount: 0,
            phases: [],
        };
        divisions.push(division);
        phasesByDivision.set(row.divisionId, new Map());

        return division;
    }

    private phaseOf(division: DivisionSummaryDto, phases: Map<number, DivisionPhaseDto>, row: StructureRow): DivisionPhaseDto {
        const existing = phases.get(row.phaseId!);
        if (existing) return existing;

        const phase: DivisionPhaseDto = {
            id: row.phaseId!,
            name: row.phaseName ?? '',
            matchCount: 0,
            phaseGroups: [],
        };
        phases.set(phase.id, phase);
        division.phases.push(phase);

        return phase;
    }

    private async entrantCounts(scope: TreeScope, id: number): Promise<Map<number, number>> {
        const rows: EntrantCountRow[] = await this.dataSource.query(ENTRANT_COUNTS_IN_SCOPE[scope], [id]);

        return new Map(rows.map((row) => [Number(row.divisionId), Number(row.entrantCount)]));
    }

    private async matchCounts(scope: TreeScope, id: number): Promise<Map<number, { progressed: number; pending: number }>> {
        const rows: MatchCountRow[] = await this.dataSource.query(MATCH_COUNTS_IN_SCOPE[scope], [id]);

        return new Map(rows.map((row) => [
            Number(row.phaseGroupId),
            { progressed: Number(row.progressedMatchCount), pending: Number(row.pendingMatchCount) },
        ]));
    }

    private async advancementRulesOf(phaseGroupIds: number[]): Promise<Map<number, AdvancementRuleDto[]>> {
        if (phaseGroupIds.length === 0) return new Map();

        const rows: AdvancementRuleRow[] = await this.dataSource.query(ADVANCEMENT_RULES_FROM_PHASE_GROUPS, [phaseGroupIds]);
        const byPhaseGroup = new Map<number, AdvancementRuleDto[]>();

        for (const rule of rows) {
            const rules = byPhaseGroup.get(rule.sourceId);
            if (rules) rules.push(rule);
            else byPhaseGroup.set(rule.sourceId, [rule]);
        }

        return byPhaseGroup;
    }
}
