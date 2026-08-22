import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { ScoringSystemType } from '@tournament-manager/scoring';
import {
    MatchListAdvancementRuleDto,
    MatchListDto,
    MatchListEntrantDto,
    MatchListResultEntryDto,
    MatchListRoundDto,
} from '@match/match-list.dto';

/**
 * Which matches a projection covers. The three read routes differ in this and
 * in nothing else, so they share one query and one mapper.
 */
type MatchScope = 'match' | 'phaseGroup' | 'division';

const SCOPE_PREDICATE: Record<MatchScope, string> = {
    match: 'm."id" = $1',
    phaseGroup: 'm."phaseGroupId" = $1',
    division: `m."phaseGroupId" IN (
        SELECT  pg."id"
        FROM    "phase_group" pg
        JOIN    "phase" ph ON ph."id" = pg."phaseId"
        WHERE   ph."divisionId" = $1
    )`,
};

/**
 * The rows `matchesInScope` produces. Changing one without the other is a bug.
 *
 * The two collections are aggregated into JSON in the database rather than
 * joined flat, so one match is one row: a flat join would multiply entrants by
 * standings and leave the grouping to be redone here. Their keys are the DTO
 * field names, which is what lets the mapper below be a copy rather than a
 * translation.
 */
type MatchRow = {
    id: number;
    name: string;
    subtitle: string | null;
    notes: string | null;
    scoringSystem: ScoringSystemType;
    active: boolean;
    phaseGroupId: number;
    matchResultId: number | null;
    matchResultPlayerPoints: MatchListResultEntryDto[] | null;
    entrants: MatchListEntrantDto[];
    rounds: MatchListRoundDto[];
};

const matchesInScope = (scope: MatchScope): string => `
    SELECT  m."id"                      AS "id",
            m."name"                    AS "name",
            m."subtitle"                AS "subtitle",
            m."notes"                   AS "notes",
            m."scoringSystem"           AS "scoringSystem",
            m."active"                  AS "active",
            m."phaseGroupId"            AS "phaseGroupId",
            mr."id"                     AS "matchResultId",
            mr."playerPoints"::json     AS "matchResultPlayerPoints",
            COALESCE(entrants."json", '[]'::json) AS "entrants",
            COALESCE(rounds."json", '[]'::json)   AS "rounds"
    FROM        "match" m
    LEFT JOIN   "match_result" mr ON mr."id" = m."matchResultId"
    LEFT JOIN LATERAL (
        SELECT  json_agg(
                    json_build_object(
                        'id', e."id",
                        'name', e."name",
                        'type', e."type",
                        'status', e."status",
                        'participants', COALESCE(participants."json", '[]'::json)
                    ) ORDER BY e."id"
                ) AS "json"
        FROM        "match_entrants_entrant" me
        JOIN        "entrant" e ON e."id" = me."entrantId"
        LEFT JOIN LATERAL (
            SELECT  json_agg(
                        json_build_object(
                            'id', pa."id",
                            'roles', CASE
                                WHEN COALESCE(pa."roles", '') = '' THEN '[]'::json
                                ELSE to_json(string_to_array(pa."roles", ','))
                            END,
                            'status', pa."status",
                            'player', json_build_object('id', pl."id", 'playerName', pl."playerName")
                        ) ORDER BY pa."id"
                    ) AS "json"
            FROM    "entrant_participants_participant" ep
            JOIN    "participant" pa ON pa."id" = ep."participantId"
            JOIN    "player" pl ON pl."id" = pa."playerId"
            WHERE   ep."entrantId" = e."id"
        ) participants ON TRUE
        WHERE   me."matchId" = m."id"
    ) entrants ON TRUE
    LEFT JOIN LATERAL (
        SELECT  json_agg(
                    json_build_object(
                        'id', r."id",
                        'song', CASE
                            WHEN so."id" IS NULL THEN NULL
                            ELSE json_build_object('id', so."id", 'title', so."title")
                        END,
                        'standings', COALESCE(standings."json", '[]'::json)
                    ) ORDER BY r."id"
                ) AS "json"
        FROM        "round" r
        LEFT JOIN   "song" so ON so."id" = r."songId"
        LEFT JOIN LATERAL (
            SELECT  json_agg(
                        json_build_object(
                            'id', st."id",
                            'points', st."points",
                            'player', json_build_object('id', sp."id", 'playerName', sp."playerName"),
                            'score', CASE
                                WHEN sc."id" IS NULL THEN NULL
                                ELSE json_build_object(
                                    'id', sc."id",
                                    'percentage', sc."percentage",
                                    'isFailed', sc."isFailed"
                                )
                            END
                        ) ORDER BY st."id"
                    ) AS "json"
            FROM        "standing" st
            JOIN        "player" sp ON sp."id" = st."playerId"
            LEFT JOIN   "score" sc ON sc."id" = st."scoreId"
            WHERE       st."roundId" = r."id"
        ) standings ON TRUE
        WHERE   r."matchId" = m."id"
    ) rounds ON TRUE
    WHERE   ${SCOPE_PREDICATE[scope]}
    ORDER BY m."id"
`;

/** The rows `ADVANCEMENT_RULES_FOR_MATCHES` produces. */
type AdvancementRuleRow = MatchListAdvancementRuleDto;

/**
 * Every rule a set of matches takes part in, incoming and outgoing together, in
 * one query. The per-match form of this lookup was issued twice inside the map
 * over a pool's matches, which is where eighty of a forty-match pool's
 * eighty-one queries came from.
 */
const ADVANCEMENT_RULES_FOR_MATCHES = `
    SELECT  ar."id"              AS "id",
            ar."sourceKind"      AS "sourceKind",
            ar."sourceId"        AS "sourceId",
            ar."sourcePlacement" AS "sourcePlacement",
            ar."targetKind"      AS "targetKind",
            ar."targetId"        AS "targetId",
            ar."targetSlot"      AS "targetSlot"
    FROM     "advancement_rule" ar
    WHERE    (ar."sourceKind" = 'match' AND ar."sourceId" = ANY($1::int[]))
        OR   (ar."targetKind" = 'match' AND ar."targetId" = ANY($1::int[]))
    ORDER BY ar."sourceId", ar."sourcePlacement", ar."targetSlot", ar."id"
`;

/** The rows `PENDING_MATCHES_BY_PHASE_GROUP` produces. */
type PendingCountRow = {
    phaseGroupId: number;
    pendingMatchCount: number;
};

/**
 * How many matches in each pool of a tournament are waiting on a person.
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
 * Its caller is the sidebar tree, which wants a count per pool and nothing
 * else, so it counts rather than loading the matches. Phase 5 folds it into
 * `TreeQueries`, which reads the rest of that tree.
 */
const PENDING_MATCHES_BY_PHASE_GROUP = `
    WITH tournament_match AS (
        SELECT m."id", m."phaseGroupId"
        FROM "match" m
        JOIN "phase_group" pg ON pg."id" = m."phaseGroupId"
        JOIN "phase" p ON p."id" = pg."phaseId"
        JOIN "division" d ON d."id" = p."divisionId"
        WHERE d."tournamentId" = $1 AND m."matchResultId" IS NULL
    ),
    match_player AS (
        SELECT DISTINCT tm."id" AS "matchId", pa."playerId"
        FROM tournament_match tm
        JOIN "match_entrants_entrant" me ON me."matchId" = tm."id"
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
        JOIN tournament_match tm ON tm."id" = r."matchId"
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
    SELECT tm."phaseGroupId" AS "phaseGroupId", COUNT(*)::int AS "pendingMatchCount"
    FROM tournament_match tm
    JOIN player_count pc ON pc."matchId" = tm."id"
    WHERE EXISTS (SELECT 1 FROM match_round mr WHERE mr."matchId" = tm."id")
      AND NOT EXISTS (SELECT 1 FROM unsettled_round ur WHERE ur."matchId" = tm."id")
    GROUP BY tm."phaseGroupId"
`;

/**
 * Every read of a match, in the one shape the interface consumes.
 *
 * It projects and nothing else: it does not write, does not publish, and does
 * not call a service. Two queries answer a request whatever its size — the
 * matches in scope, then the advancement rules of all of them at once.
 */
@Injectable()
export class MatchQueries {
    constructor(
        @InjectDataSource()
        private readonly dataSource: DataSource,
    ) {}

    async byId(id: number): Promise<MatchListDto | null> {
        const [match] = await this.inScope('match', id);
        return match ?? null;
    }

    async byPhaseGroup(phaseGroupId: number): Promise<MatchListDto[]> {
        return await this.inScope('phaseGroup', phaseGroupId);
    }

    async byDivision(divisionId: number): Promise<MatchListDto[]> {
        return await this.inScope('division', divisionId);
    }

    /** Whether a match exists, for the callers that only need to refuse when it does not. */
    async exists(id: number): Promise<boolean> {
        const rows: Array<{ id: number }> = await this.dataSource.query('SELECT m."id" AS "id" FROM "match" m WHERE m."id" = $1', [id]);

        return rows.length > 0;
    }

    async pendingCountsByPhaseGroup(tournamentId: number): Promise<Map<number, number>> {
        const rows: PendingCountRow[] = await this.dataSource.query(PENDING_MATCHES_BY_PHASE_GROUP, [tournamentId]);

        return new Map(rows.map((row) => [Number(row.phaseGroupId), Number(row.pendingMatchCount)]));
    }

    private async inScope(scope: MatchScope, id: number): Promise<MatchListDto[]> {
        const rows: MatchRow[] = await this.dataSource.query(matchesInScope(scope), [id]);
        if (rows.length === 0) return [];

        const rules = await this.advancementRulesOf(rows.map((row) => row.id));

        return rows.map((row) => ({
            id: row.id,
            name: row.name,
            subtitle: row.subtitle,
            notes: row.notes,
            scoringSystem: row.scoringSystem,
            active: row.active,
            entrants: row.entrants,
            rounds: row.rounds,
            advancementRules: rules.get(row.id) ?? [],
            matchResult: row.matchResultId === null
                ? null
                : { id: row.matchResultId, playerPoints: row.matchResultPlayerPoints ?? [] },
            phaseGroupId: row.phaseGroupId,
        }));
    }

    private async advancementRulesOf(matchIds: number[]): Promise<Map<number, MatchListAdvancementRuleDto[]>> {
        const rows: AdvancementRuleRow[] = await this.dataSource.query(ADVANCEMENT_RULES_FOR_MATCHES, [matchIds]);
        const byMatch = new Map<number, MatchListAdvancementRuleDto[]>();

        /* A rule reaches the match it leaves and the match it feeds, and the
           same rule can do both for two different matches in the same list. A
           rule that leaves and feeds the same match is carried once. */
        for (const rule of rows) {
            const leavesAMatch = rule.sourceKind === 'match';
            if (leavesAMatch) this.append(byMatch, rule.sourceId, rule);
            if (rule.targetKind === 'match' && !(leavesAMatch && rule.sourceId === rule.targetId)) {
                this.append(byMatch, rule.targetId, rule);
            }
        }

        return byMatch;
    }

    private append(byMatch: Map<number, MatchListAdvancementRuleDto[]>, matchId: number, rule: MatchListAdvancementRuleDto): void {
        const rules = byMatch.get(matchId);
        if (rules) rules.push(rule);
        else byMatch.set(matchId, [rule]);
    }
}
