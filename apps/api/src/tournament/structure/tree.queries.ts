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

/** The rows `PENDING_MATCHES_IN_SCOPE` produces. */
type PendingCountRow = {
    phaseGroupId: number;
    pendingMatchCount: number;
};

type ProgressedCountRow = {
    phaseGroupId: number;
    progressedMatchCount: number;
};

/**
 * How many matches carry evidence that competition has started.
 *
 * Players, songs and bracket slots are preparation. A played score or positive
 * hand-scored standing is progress, as is a committed result.
 */
const progressedMatchesInScope = (predicate: string): string => `
    SELECT m."phaseGroupId" AS "phaseGroupId", COUNT(*)::int AS "progressedMatchCount"
    FROM "match" m
    JOIN "phase_group" pg ON pg."id" = m."phaseGroupId"
    JOIN "phase" ph ON ph."id" = pg."phaseId"
    JOIN "division" d ON d."id" = ph."divisionId"
    WHERE ${predicate}
      AND (
          m."matchResultId" IS NOT NULL
          OR EXISTS (
              SELECT 1
              FROM "round" r
              JOIN "standing" s ON s."roundId" = r."id"
              WHERE r."matchId" = m."id"
                AND (s."scoreId" IS NOT NULL OR s."points" > 0)
          )
      )
    GROUP BY m."phaseGroupId"
`;

/** The same, for the progressed count. */
const PROGRESSED_MATCHES_IN_SCOPE: Record<TreeScope, string> = {
    tournament: progressedMatchesInScope(SCOPE_PREDICATE.tournament),
    division: progressedMatchesInScope(SCOPE_PREDICATE.division),
    phaseGroup: progressedMatchesInScope(SCOPE_PREDICATE.phaseGroup),
};

/**
 * How many matches in each pool are waiting on a result action.
 *
 * A match is waiting when it has players, has rounds, has no committed result,
 * and every one of its rounds is settled. A round played on a song is settled
 * when every player has a standing in it; a hand-scored round is settled as
 * soon as somebody has been given a point, because one to nothing is a result
 * and nobody owes a zero.
 *
 * A settled match may be ready to commit or may require a tiebreak first. Both
 * are pending operator work and therefore keep the pool's pending count.
 *
 * It counts rather than loading the matches, because its caller wants a number
 * per pool and nothing else. A standing counts only for a player the match
 * holds, which used to be a correlated `EXISTS` inside a `LEFT JOIN ... ON`
 * clause and is now a join to `match_player`; a match with no round produces no
 * row to join, which is what the separate emptiness test used to say.
 */
const pendingMatchesInScope = (predicate: string): string => `
    WITH scoped_match AS (
        SELECT m."id", m."phaseGroupId"
        FROM "match" m
        JOIN "phase_group" pg ON pg."id" = m."phaseGroupId"
        JOIN "phase" ph ON ph."id" = pg."phaseId"
        JOIN "division" d ON d."id" = ph."divisionId"
        WHERE ${predicate} AND m."matchResultId" IS NULL
    ),
    match_player AS (
        SELECT DISTINCT sm."id" AS "matchId", pa."playerId"
        FROM scoped_match sm
        JOIN "match_entrants_entrant" me ON me."matchId" = sm."id"
        JOIN "entrant" e ON e."id" = me."entrantId" AND e."type" = 'player'
        JOIN "entrant_participants_participant" ep ON ep."entrantId" = e."id"
        JOIN "participant" pa ON pa."id" = ep."participantId"
    ),
    round_fill AS (
        SELECT r."matchId",
               r."songId" IS NOT NULL AS "played",
               COUNT(DISTINCT st."playerId") FILTER (WHERE mp."playerId" IS NOT NULL) AS "entered",
               COUNT(*) FILTER (WHERE mp."playerId" IS NOT NULL AND st."points" > 0) AS "stated"
        FROM "round" r
        JOIN scoped_match sm ON sm."id" = r."matchId"
        LEFT JOIN "standing" st ON st."roundId" = r."id"
        LEFT JOIN match_player mp ON mp."matchId" = r."matchId" AND mp."playerId" = st."playerId"
        GROUP BY r."matchId", r."id", r."songId"
    ),
    match_fill AS (
        SELECT rf."matchId",
               COUNT(*) FILTER (
                   WHERE (rf."played" AND rf."entered" < pc."players")
                      OR (NOT rf."played" AND rf."stated" = 0)
               ) AS "unsettled"
        FROM round_fill rf
        JOIN (
            SELECT "matchId", COUNT(*) AS "players"
            FROM match_player
            GROUP BY "matchId"
        ) pc ON pc."matchId" = rf."matchId"
        GROUP BY rf."matchId"
    )
    SELECT sm."phaseGroupId" AS "phaseGroupId", COUNT(*)::int AS "pendingMatchCount"
    FROM scoped_match sm
    JOIN match_fill mf ON mf."matchId" = sm."id"
    WHERE mf."unsettled" = 0
    GROUP BY sm."phaseGroupId"
`;

/** The same, for the pending count. */
const PENDING_MATCHES_IN_SCOPE: Record<TreeScope, string> = {
    tournament: pendingMatchesInScope(SCOPE_PREDICATE.tournament),
    division: pendingMatchesInScope(SCOPE_PREDICATE.division),
    phaseGroup: pendingMatchesInScope(SCOPE_PREDICATE.phaseGroup),
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
 * projection answers all three and each read costs four queries whatever its
 * scope holds: the structure, progressed and pending match counts for every
 * pool in it, and the advancement rules of all of them together.
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

        const [entrants, progressed, pending, rules] = await Promise.all([
            this.entrantCounts(scope, id),
            this.progressedCounts(scope, id),
            this.pendingCounts(scope, id),
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
                progressedMatchCount: progressed.get(row.phaseGroupId) ?? 0,
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
        entrantCount: number,
    ): DivisionSummaryDto {
        const existing = divisions.find((division) => division.id === row.divisionId);
        if (existing) return existing;

        const division: DivisionSummaryDto = {
            id: row.divisionId,
            name: row.divisionName,
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

    private async pendingCounts(scope: TreeScope, id: number): Promise<Map<number, number>> {
        const rows: PendingCountRow[] = await this.dataSource.query(PENDING_MATCHES_IN_SCOPE[scope], [id]);

        return new Map(rows.map((row) => [Number(row.phaseGroupId), Number(row.pendingMatchCount)]));
    }

    private async progressedCounts(scope: TreeScope, id: number): Promise<Map<number, number>> {
        const rows: ProgressedCountRow[] = await this.dataSource.query(PROGRESSED_MATCHES_IN_SCOPE[scope], [id]);

        return new Map(rows.map((row) => [Number(row.phaseGroupId), Number(row.progressedMatchCount)]));
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
