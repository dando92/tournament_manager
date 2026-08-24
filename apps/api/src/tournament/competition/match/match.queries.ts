import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { ScoringSystemType } from '@tournament-manager/scoring';
import {
    AdvancementRuleDto,
    MatchDto,
    EntrantDto,
    MatchResultEntryDto,
    MatchRoundDto,
    SongRefDto,
} from '@tournament-manager/contracts';

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
    matchResultPlayerPoints: MatchResultEntryDto[] | null;
    entrants: EntrantDto[];
    rounds: MatchRoundDto[];
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
type AdvancementRuleRow = AdvancementRuleDto;

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

/** The rows `LIVE_TARGETS_FOR_SONG` produces. */
type LiveTargetRow = { matchId: number; roundId: number; playerId: number };

/**
 * Where a run reported by a lobby belongs: the round of a live match that is
 * waiting for this player on this song.
 *
 * A match qualifies when it is active, holds a round played on the song, has
 * the player as a singles entrant, and has no standing for them in that round
 * yet. That is the rule the ingestion used to apply by loading every active
 * match of the tournament with its entrants, its rounds, its standings and the
 * scores behind them, once per player in the lobby. It is asked once for a
 * completed song, because one completed song reports one score per player.
 *
 * A player waiting in two matches at once is answered with the older of them,
 * which is the order the previous load happened to produce.
 */
const LIVE_TARGETS_FOR_SONG = `
    SELECT DISTINCT ON (pa."playerId")
            pa."playerId" AS "playerId",
            r."matchId"   AS "matchId",
            r."id"        AS "roundId"
    FROM        "round" r
    JOIN        "match" m        ON m."id"  = r."matchId" AND m."active" = TRUE
    JOIN        "phase_group" pg ON pg."id" = m."phaseGroupId"
    JOIN        "phase" ph       ON ph."id" = pg."phaseId"
    JOIN        "division" d     ON d."id"  = ph."divisionId"
    JOIN        "match_entrants_entrant" me ON me."matchId" = m."id"
    JOIN        "entrant" e      ON e."id"  = me."entrantId" AND e."type" = 'player'
    JOIN        "entrant_participants_participant" ep ON ep."entrantId" = e."id"
    JOIN        "participant" pa ON pa."id" = ep."participantId"
    WHERE       d."tournamentId" = $1
        AND     r."songId" = $2
        AND     pa."playerId" = ANY($3::int[])
        AND     NOT EXISTS (
            SELECT  1
            FROM    "standing" s
            WHERE   s."roundId" = r."id" AND s."playerId" = pa."playerId"
        )
    ORDER BY pa."playerId", m."id", r."id"
`;

const ACTIVE_TOURNAMENT_SONGS_BASE = `
    SELECT
            so."id"    AS "id",
            so."title" AS "title"
    FROM        "round" r
    JOIN        "song" so       ON so."id" = r."songId"
    JOIN        "match" m       ON m."id" = r."matchId" AND m."active" = TRUE
    JOIN        "phase_group" pg ON pg."id" = m."phaseGroupId"
    JOIN        "phase" ph       ON ph."id" = pg."phaseId"
    JOIN        "division" d     ON d."id" = ph."divisionId"
    WHERE       d."tournamentId" = $1
`;

const ACTIVE_TOURNAMENT_SONGS = `
    SELECT DISTINCT ON (active_song."title")
            active_song."id",
            active_song."title"
    FROM (${ACTIVE_TOURNAMENT_SONGS_BASE}) active_song
    ORDER BY active_song."title", active_song."id"
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

    async byId(id: number): Promise<MatchDto | null> {
        const [match] = await this.inScope('match', id);
        return match ?? null;
    }

    async byPhaseGroup(phaseGroupId: number): Promise<MatchDto[]> {
        return await this.inScope('phaseGroup', phaseGroupId);
    }

    async byDivision(divisionId: number): Promise<MatchDto[]> {
        return await this.inScope('division', divisionId);
    }

    /**
     * The rounds waiting for these players on this song, one per player.
     *
     * The lobby ingestion asks this once for a completed song, and then writes
     * each match it named exactly once.
     */
    async liveTargetsForSong(tournamentId: number, songId: number, playerIds: number[]): Promise<LiveTargetRow[]> {
        if (playerIds.length === 0) return [];

        return await this.dataSource.query(LIVE_TARGETS_FOR_SONG, [tournamentId, songId, playerIds]);
    }

    /** Every distinct song assigned to a match currently accepting lobby results. */
    async activeSongsForTournament(tournamentId: number): Promise<SongRefDto[]> {
        return await this.dataSource.query(ACTIVE_TOURNAMENT_SONGS, [tournamentId]);
    }

    async activeSongForTournament(tournamentId: number, songId: number): Promise<SongRefDto | null> {
        const songs = await this.dataSource.query<SongRefDto[]>(
            `${ACTIVE_TOURNAMENT_SONGS_BASE}
             AND so."id" = $2`,
            [tournamentId, songId],
        );
        return songs[0] ?? null;
    }

    /** Whether a match exists, for the callers that only need to refuse when it does not. */
    async exists(id: number): Promise<boolean> {
        const rows: Array<{ id: number }> = await this.dataSource.query('SELECT m."id" AS "id" FROM "match" m WHERE m."id" = $1', [id]);

        return rows.length > 0;
    }

    private async inScope(scope: MatchScope, id: number): Promise<MatchDto[]> {
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

    private async advancementRulesOf(matchIds: number[]): Promise<Map<number, AdvancementRuleDto[]>> {
        const rows: AdvancementRuleRow[] = await this.dataSource.query(ADVANCEMENT_RULES_FOR_MATCHES, [matchIds]);
        const byMatch = new Map<number, AdvancementRuleDto[]>();

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

    private append(byMatch: Map<number, AdvancementRuleDto[]>, matchId: number, rule: AdvancementRuleDto): void {
        const rules = byMatch.get(matchId);
        if (rules) rules.push(rule);
        else byMatch.set(matchId, [rule]);
    }
}
