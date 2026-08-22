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
 * The rows `structureInScope` produces: one per pool, carrying the division and
 * phase it hangs from. Changing one without the other is a bug.
 *
 * A division with no phases and a phase with no pools still appear, with nulls
 * from the identifier onwards, because the tree draws an empty branch rather
 * than hiding it.
 */
type StructureRow = {
    divisionId: number;
    divisionName: string;
    divisionEntrantCount: number;
    phaseId: number | null;
    phaseName: string | null;
    phaseGroupId: number | null;
    phaseGroupName: string | null;
    displayIdentifier: string | null;
    bracketType: string | null;
    state: PhaseGroupState | null;
    matchCount: number;
};

const structureInScope = (scope: TreeScope): string => `
    SELECT  d."id"                  AS "divisionId",
            d."name"                AS "divisionName",
            entrants."count"        AS "divisionEntrantCount",
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
        FROM    "entrant" e
        WHERE   e."divisionId" = d."id" AND e."status" = 'active'
    ) entrants ON TRUE
    LEFT JOIN LATERAL (
        SELECT  COUNT(*)::int AS "count"
        FROM    "match" m
        WHERE   m."phaseGroupId" = pg."id"
    ) matches ON TRUE
    WHERE    ${SCOPE_PREDICATE[scope]}
    ORDER BY d."id", ph."id", pg."id"
`;

/** The rows `pendingMatchesInScope` produces. */
type PendingCountRow = {
    phaseGroupId: number;
    pendingMatchCount: number;
};

/**
 * How many matches in each pool are waiting on a person.
 *
 * A match is waiting when it has players, has rounds, has no committed result,
 * and every one of its rounds is settled. A round played on a song is settled
 * when every player has a standing in it; a hand-scored round is settled as
 * soon as somebody has been given a point, because one to nothing is a result
 * and nobody owes a zero.
 *
 * That is the same rule the match card draws as "Ready to commit"
 * (`getMatchProgress` in the frontend) and the one the commit enforces
 * (`MatchAggregate.commit`); the three must be changed together.
 *
 * It counts rather than loading the matches, because its caller wants a number
 * per pool and nothing else.
 */
const pendingMatchesInScope = (scope: TreeScope): string => `
    WITH scoped_match AS (
        SELECT m."id", m."phaseGroupId"
        FROM "match" m
        JOIN "phase_group" pg ON pg."id" = m."phaseGroupId"
        JOIN "phase" ph ON ph."id" = pg."phaseId"
        JOIN "division" d ON d."id" = ph."divisionId"
        WHERE ${SCOPE_PREDICATE[scope]} AND m."matchResultId" IS NULL
    ),
    match_player AS (
        SELECT DISTINCT sm."id" AS "matchId", pa."playerId"
        FROM scoped_match sm
        JOIN "match_entrants_entrant" me ON me."matchId" = sm."id"
        JOIN "entrant" e ON e."id" = me."entrantId" AND e."type" = 'player'
        JOIN "entrant_participants_participant" ep ON ep."entrantId" = e."id"
        JOIN "participant" pa ON pa."id" = ep."participantId"
    ),
    player_count AS (
        SELECT "matchId", COUNT(*) AS "players"
        FROM match_player
        GROUP BY "matchId"
    ),
    match_round AS (
        SELECT r."matchId", r."id" AS "roundId", r."songId" IS NOT NULL AS "played"
        FROM "round" r
        JOIN scoped_match sm ON sm."id" = r."matchId"
    ),
    round_fill AS (
        SELECT
            mr."matchId",
            mr."roundId",
            mr."played",
            COUNT(DISTINCT s."playerId") AS "entered",
            COUNT(*) FILTER (WHERE s."points" > 0) AS "stated"
        FROM match_round mr
        LEFT JOIN "standing" s
            ON s."roundId" = mr."roundId"
            AND EXISTS (
                SELECT 1 FROM match_player mp
                WHERE mp."matchId" = mr."matchId" AND mp."playerId" = s."playerId"
            )
        GROUP BY mr."matchId", mr."roundId", mr."played"
    ),
    unsettled_round AS (
        SELECT DISTINCT rf."matchId"
        FROM round_fill rf
        JOIN player_count pc ON pc."matchId" = rf."matchId"
        WHERE (rf."played" AND rf."entered" < pc."players")
           OR (NOT rf."played" AND rf."stated" = 0)
    )
    SELECT sm."phaseGroupId" AS "phaseGroupId", COUNT(*)::int AS "pendingMatchCount"
    FROM scoped_match sm
    JOIN player_count pc ON pc."matchId" = sm."id"
    WHERE EXISTS (SELECT 1 FROM match_round mr WHERE mr."matchId" = sm."id")
      AND NOT EXISTS (SELECT 1 FROM unsettled_round ur WHERE ur."matchId" = sm."id")
    GROUP BY sm."phaseGroupId"
`;

/** The rows `ADVANCEMENT_RULES_FROM_PHASE_GROUPS` produces. */
type AdvancementRuleRow = AdvancementRuleDto;

/** Where a set of pools sends its finishers, for all of them at once. */
const ADVANCEMENT_RULES_FROM_PHASE_GROUPS = `
    SELECT  ar."id"              AS "id",
            ar."sourceKind"      AS "sourceKind",
            ar."sourceId"        AS "sourceId",
            ar."sourcePlacement" AS "sourcePlacement",
            ar."targetKind"      AS "targetKind",
            ar."targetId"        AS "targetId",
            ar."targetSlot"      AS "targetSlot"
    FROM     "advancement_rule" ar
    WHERE    ar."sourceKind" = 'phase_group' AND ar."sourceId" = ANY($1::int[])
    ORDER BY ar."sourceId", ar."sourcePlacement", ar."targetSlot", ar."id"
`;

/**
 * The read that spans division, phase and pool.
 *
 * Three routes ask the same question of different amounts of the tree, so one
 * projection answers all three and each read costs three queries whatever its
 * scope holds: the structure, the pending counts of every pool in it, and the
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
        const rows: StructureRow[] = await this.dataSource.query(structureInScope(scope), [id]);
        if (rows.length === 0) return [];

        const [pending, rules] = await Promise.all([
            this.pendingCounts(scope, id),
            this.advancementRulesOf(rows.map((row) => row.phaseGroupId).filter((value): value is number => value !== null)),
        ]);

        const divisions: DivisionSummaryDto[] = [];
        const phasesByDivision = new Map<number, Map<number, DivisionPhaseDto>>();

        for (const row of rows) {
            const division = this.divisionOf(divisions, phasesByDivision, row);
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
                pendingMatchCount: pending.get(row.phaseGroupId) ?? 0,
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
    ): DivisionSummaryDto {
        const existing = divisions.find((division) => division.id === row.divisionId);
        if (existing) return existing;

        const division: DivisionSummaryDto = {
            id: row.divisionId,
            name: row.divisionName,
            entrantCount: row.divisionEntrantCount,
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

    private async pendingCounts(scope: TreeScope, id: number): Promise<Map<number, number>> {
        const rows: PendingCountRow[] = await this.dataSource.query(pendingMatchesInScope(scope), [id]);

        return new Map(rows.map((row) => [Number(row.phaseGroupId), Number(row.pendingMatchCount)]));
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
