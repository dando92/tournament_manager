import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { ScoringSystemType } from '@tournament-manager/scoring';
import {
    AdvancementRuleDto,
    MatchDto,
    MatchState,
    MatchSummaryDto,
    MatchSummaryEntrantDto,
    EntrantDto,
    MatchResultEntryDto,
    MatchResultStateDto,
    MatchRoundDto,
    MatchTiebreakDto,
    PlayerRefDto,
    SongRefDto,
} from '@tournament-manager/contracts';
import { resolvePlacements } from '@match/placement.resolver';

/**
 * Which matches a projection covers. The three read routes differ in this and
 * in nothing else, so they share one query and one mapper.
 */
type MatchScope = 'match' | 'ids' | 'phaseGroup' | 'division' | 'tournament';

const SCOPE_PREDICATE: Record<MatchScope, string> = {
    match: 'm."id" = $1',
    ids: 'm."id" = ANY($1::int[])',
    phaseGroup: 'm."phaseGroupId" = $1',
    division: `m."phaseGroupId" IN (
        SELECT  pg."id"
        FROM    "phase_group" pg
        JOIN    "phase" ph ON ph."id" = pg."phaseId"
        WHERE   ph."divisionId" = $1
    )`,
    tournament: `m."phaseGroupId" IN (
        SELECT  pg."id"
        FROM    "phase_group" pg
        JOIN    "phase" ph ON ph."id" = pg."phaseId"
        JOIN    "division" d ON d."id" = ph."divisionId"
        WHERE   d."tournamentId" = $1
    )`,
};

/**
 * The rows `MATCHES_IN_SCOPE` produces. Changing one without the other is a bug.
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
    state: MatchState;
    phaseGroupId: number;
    matchResultId: number | null;
    matchResultPlayerPoints: MatchResultEntryDto[] | null;
    entrants: EntrantDto[];
    rounds: MatchRoundDto[];
    tiebreaks: MatchTiebreakDto[];
};

const matchesInScope = (predicate: string): string => `
    SELECT  m."id"                      AS "id",
            m."name"                    AS "name",
            m."subtitle"                AS "subtitle",
            m."notes"                   AS "notes",
            m."scoringSystem"           AS "scoringSystem",
            m."active"                  AS "active",
            m."state"                   AS "state",
            m."phaseGroupId"            AS "phaseGroupId",
            mr."id"                     AS "matchResultId",
            mr."playerPoints"           AS "matchResultPlayerPoints",
            COALESCE(entrants."json", '[]'::json) AS "entrants",
            COALESCE(rounds."json", '[]'::json)   AS "rounds",
            COALESCE(tiebreaks."json", '[]'::json) AS "tiebreaks"
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
                            'roles', to_json(pa."roles"),
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
    LEFT JOIN LATERAL (
        SELECT  json_agg(
                    json_build_object(
                        'id', mt."id",
                        'sequence', mt."sequence",
                        'invalidated', mt."invalidated",
                        'song', CASE
                            WHEN ts."id" IS NULL THEN NULL
                            ELSE json_build_object('id', ts."id", 'title', ts."title")
                        END,
                        'standings', COALESCE(tiebreak_standings."json", '[]'::json)
                    ) ORDER BY mt."sequence", mt."id"
                ) AS "json"
        FROM        "match_tiebreak" mt
        LEFT JOIN   "song" ts ON ts."id" = mt."songId"
        LEFT JOIN LATERAL (
            SELECT  json_agg(
                        json_build_object(
                            'id', mts."id",
                            'manualPoints', mts."manualPoints",
                            'player', json_build_object('id', tp."id", 'playerName', tp."playerName"),
                            'score', CASE
                                WHEN tsc."id" IS NULL THEN NULL
                                ELSE json_build_object(
                                    'id', tsc."id",
                                    'percentage', tsc."percentage",
                                    'isFailed', tsc."isFailed"
                                )
                            END
                        ) ORDER BY mts."id"
                    ) AS "json"
            FROM        "match_tiebreak_standing" mts
            JOIN        "player" tp ON tp."id" = mts."playerId"
            LEFT JOIN   "score" tsc ON tsc."id" = mts."scoreId"
            WHERE       mts."tiebreakId" = mt."id"
        ) tiebreak_standings ON TRUE
        WHERE mt."matchId" = m."id"
    ) tiebreaks ON TRUE
    WHERE   ${predicate}
    ORDER BY m."id"
`;

/** One query per scope, built once at module load rather than on every read. */
const MATCHES_IN_SCOPE: Record<MatchScope, string> = {
    match: matchesInScope(SCOPE_PREDICATE.match),
    ids: matchesInScope(SCOPE_PREDICATE.ids),
    phaseGroup: matchesInScope(SCOPE_PREDICATE.phaseGroup),
    division: matchesInScope(SCOPE_PREDICATE.division),
    tournament: matchesInScope(SCOPE_PREDICATE.tournament),
};

/**
 * The rows `MATCH_SUMMARIES_IN_SCOPE` produces.
 *
 * Everything a list draws, and nothing a card does. Rounds, standings, scores
 * and tiebreaks are counts and booleans here rather than the JSON the full
 * projection aggregates: that aggregation is what made a board of 720 entries
 * cost 81 ms, and no reader of a timetable row ever opened one of them. The
 * lineup stays a collection, because a row names who is playing.
 *
 * `scoredCount` is the standings recorded on rounds played on a song. The
 * mapper turns it into the runs still missing, which is the only form a row
 * reads it in.
 */
type MatchSummaryRow = {
    id: number;
    name: string;
    subtitle: string | null;
    active: boolean;
    state: MatchState;
    phaseGroupId: number;
    entrants: MatchSummaryEntrantDto[];
    songCount: string | number;
    handScored: boolean;
    scoredCount: string | number;
    tiebreakInProgress: boolean;
    winner: PlayerRefDto | null;
};

/**
 * A tiebreak attempt that is on the table and still waiting.
 *
 * The settled predicate is `MatchAggregate.isTiebreakComplete` and its browser
 * twin in `tiebreaks.ts`, written here a third time in SQL because a list
 * cannot afford to carry the attempts themselves. The three must change
 * together: an attempt played on a song waits for every score, a stated one is
 * settled by the first point above zero, and neither is settled below two
 * players.
 */
const TIEBREAK_IN_PROGRESS = `
    EXISTS (
        SELECT  1
        FROM    "match_tiebreak" mt
        WHERE   mt."matchId" = m."id"
            AND mt."invalidated" = FALSE
            AND NOT (
                (SELECT count(*) FROM "match_tiebreak_standing" s WHERE s."tiebreakId" = mt."id") >= 2
                AND CASE
                    WHEN mt."songId" IS NULL THEN EXISTS (
                        SELECT 1 FROM "match_tiebreak_standing" s
                        WHERE s."tiebreakId" = mt."id" AND COALESCE(s."manualPoints", 0) > 0
                    )
                    ELSE NOT EXISTS (
                        SELECT 1 FROM "match_tiebreak_standing" s
                        WHERE s."tiebreakId" = mt."id" AND s."scoreId" IS NULL
                    )
                END
            )
    )
`;

const matchSummariesInScope = (predicate: string): string => `
    SELECT  m."id"                      AS "id",
            m."name"                    AS "name",
            m."subtitle"                AS "subtitle",
            m."active"                  AS "active",
            m."state"                   AS "state",
            m."phaseGroupId"            AS "phaseGroupId",
            COALESCE(entrants."json", '[]'::json) AS "entrants",
            COALESCE(rounds."songCount", 0)      AS "songCount",
            COALESCE(rounds."handScored", FALSE) AS "handScored",
            COALESCE(rounds."scoredCount", 0)    AS "scoredCount",
            ${TIEBREAK_IN_PROGRESS}     AS "tiebreakInProgress",
            winner."json"               AS "winner"
    FROM        "match" m
    LEFT JOIN   "match_result" mr ON mr."id" = m."matchResultId"
    LEFT JOIN LATERAL (
        SELECT  json_agg(
                    json_build_object(
                        'id', e."id",
                        'name', e."name",
                        'type', e."type",
                        'player', player."json"
                    ) ORDER BY e."id"
                ) AS "json"
        FROM        "match_entrants_entrant" me
        JOIN        "entrant" e ON e."id" = me."entrantId"
        LEFT JOIN LATERAL (
            SELECT   json_build_object('id', pl."id", 'playerName', pl."playerName") AS "json"
            FROM     "entrant_participants_participant" ep
            JOIN     "participant" pa ON pa."id" = ep."participantId"
            JOIN     "player" pl ON pl."id" = pa."playerId"
            WHERE    ep."entrantId" = e."id" AND e."type" = 'player'
            ORDER BY pa."id"
            LIMIT    1
        ) player ON TRUE
        WHERE   me."matchId" = m."id"
    ) entrants ON TRUE
    LEFT JOIN LATERAL (
        SELECT      count(*) FILTER (WHERE r."songId" IS NOT NULL) AS "songCount",
                    bool_or(r."songId" IS NULL)                    AS "handScored",
                    COALESCE(sum(standings."count") FILTER (WHERE r."songId" IS NOT NULL), 0) AS "scoredCount"
        FROM        "round" r
        LEFT JOIN LATERAL (
            SELECT count(*) AS "count" FROM "standing" st WHERE st."roundId" = r."id"
        ) standings ON TRUE
        WHERE       r."matchId" = m."id"
    ) rounds ON TRUE
    LEFT JOIN LATERAL (
        SELECT  json_build_object('id', wp."id", 'playerName', wp."playerName") AS "json"
        FROM    jsonb_array_elements(mr."playerPoints") AS placement
        JOIN    "player" wp ON wp."id" = (placement->>'playerId')::int
        WHERE   (placement->>'placement')::int = 1
        LIMIT   1
    ) winner ON TRUE
    WHERE   ${predicate}
    ORDER BY m."id"
`;

/** The same scopes as the full projection, so a caller narrows the level and not the rows. */
const MATCH_SUMMARIES_IN_SCOPE: Record<MatchScope, string> = {
    match: matchSummariesInScope(SCOPE_PREDICATE.match),
    ids: matchSummariesInScope(SCOPE_PREDICATE.ids),
    phaseGroup: matchSummariesInScope(SCOPE_PREDICATE.phaseGroup),
    division: matchSummariesInScope(SCOPE_PREDICATE.division),
    tournament: matchSummariesInScope(SCOPE_PREDICATE.tournament),
};

/**
 * Only the rules that feed a set of matches.
 *
 * A row says what a match is still waiting for; where its own winner goes next
 * is the card's business, and asking for both doubled the rows this returns.
 */
const INCOMING_ADVANCEMENT_RULES_FOR_MATCHES = `
    SELECT  ar."id"              AS "id",
            ar."sourceKind"      AS "sourceKind",
            ar."sourceId"        AS "sourceId",
            COALESCE(sm."name", spg."name") AS "sourceName",
            ar."sourcePlacement" AS "sourcePlacement",
            ar."targetKind"      AS "targetKind",
            ar."targetId"        AS "targetId",
            tm."name"            AS "targetName",
            ar."targetSlot"      AS "targetSlot"
    FROM      "advancement_rule" ar
    LEFT JOIN "match" sm ON ar."sourceKind" = 'match' AND sm."id" = ar."sourceId"
    LEFT JOIN "phase_group" spg ON ar."sourceKind" = 'phase_group' AND spg."id" = ar."sourceId"
    LEFT JOIN "match" tm ON tm."id" = ar."targetId"
    WHERE     ar."targetKind" = 'match' AND ar."targetId" = ANY($1::int[])
    ORDER BY  ar."targetId", ar."targetSlot", ar."id"
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
            COALESCE(sm."name", spg."name") AS "sourceName",
            ar."sourcePlacement" AS "sourcePlacement",
            ar."targetKind"      AS "targetKind",
            ar."targetId"        AS "targetId",
            COALESCE(tm."name", tpg."name") AS "targetName",
            ar."targetSlot"      AS "targetSlot"
    FROM      "advancement_rule" ar
    LEFT JOIN "match" sm ON ar."sourceKind" = 'match' AND sm."id" = ar."sourceId"
    LEFT JOIN "phase_group" spg ON ar."sourceKind" = 'phase_group' AND spg."id" = ar."sourceId"
    LEFT JOIN "match" tm ON ar."targetKind" = 'match' AND tm."id" = ar."targetId"
    LEFT JOIN "phase_group" tpg ON ar."targetKind" = 'phase_group' AND tpg."id" = ar."targetId"
    WHERE    (ar."sourceKind" = 'match' AND ar."sourceId" = ANY($1::int[]))
        OR   (ar."targetKind" = 'match' AND ar."targetId" = ANY($1::int[]))
    ORDER BY ar."sourceId", ar."sourcePlacement", ar."targetSlot", ar."id"
`;

/** The rows `LIVE_TARGETS_FOR_SONG` produces. */
type LiveTargetRow = {
    matchId: number;
    targetKind: 'round' | 'tiebreak';
    targetId: number;
    playerId: number;
};

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
    SELECT DISTINCT ON (target."playerId")
            target."playerId",
            target."matchId",
            target."targetKind",
            target."targetId"
    FROM (
        SELECT  pa."playerId" AS "playerId",
                r."matchId" AS "matchId",
                'round'::varchar AS "targetKind",
                r."id" AS "targetId",
                1 AS priority
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
                SELECT 1 FROM "standing" s
                WHERE s."roundId" = r."id" AND s."playerId" = pa."playerId"
            )

        UNION ALL

        SELECT  mts."playerId" AS "playerId",
                mt."matchId" AS "matchId",
                'tiebreak'::varchar AS "targetKind",
                mt."id" AS "targetId",
                0 AS priority
        FROM        "match_tiebreak" mt
        JOIN        "match" m        ON m."id" = mt."matchId" AND m."active" = TRUE
        JOIN        "phase_group" pg ON pg."id" = m."phaseGroupId"
        JOIN        "phase" ph       ON ph."id" = pg."phaseId"
        JOIN        "division" d     ON d."id" = ph."divisionId"
        JOIN        "match_tiebreak_standing" mts ON mts."tiebreakId" = mt."id"
        WHERE       d."tournamentId" = $1
            AND     mt."songId" = $2
            AND     mt."invalidated" = FALSE
            AND     mts."playerId" = ANY($3::int[])
            AND     mts."scoreId" IS NULL
    ) target
    ORDER BY target."playerId", target.priority, target."matchId", target."targetId"
`;

/** The rows `ACTIVE_TOURNAMENT_SONGS` and `ACTIVE_TOURNAMENT_SONG` produce. */
type ActiveSongRow = SongRefDto;

/**
 * Every song a match of the tournament is currently playing, once per match
 * that plays it: a round of an active match, or a tiebreak of one that has not
 * been invalidated.
 *
 * The tournament is filtered inside both branches rather than around the union.
 * Outside it, each branch had to produce every active song of the installation
 * before the filter could discard all but one tournament's.
 *
 * It is a fragment: both queries below wrap it, and neither works without a
 * `$1` bound to the tournament.
 */
const ACTIVE_TOURNAMENT_SONGS_BASE = `
    SELECT so."id", so."title"
    FROM        "round" r
    JOIN        "song" so        ON so."id" = r."songId"
    JOIN        "match" m        ON m."id" = r."matchId" AND m."active" = TRUE
    JOIN        "phase_group" pg ON pg."id" = m."phaseGroupId"
    JOIN        "phase" ph       ON ph."id" = pg."phaseId"
    JOIN        "division" d     ON d."id" = ph."divisionId"
    WHERE       d."tournamentId" = $1

    UNION ALL

    SELECT so."id", so."title"
    FROM        "match_tiebreak" mt
    JOIN        "song" so        ON so."id" = mt."songId"
    JOIN        "match" m        ON m."id" = mt."matchId" AND m."active" = TRUE
    JOIN        "phase_group" pg ON pg."id" = m."phaseGroupId"
    JOIN        "phase" ph       ON ph."id" = pg."phaseId"
    JOIN        "division" d     ON d."id" = ph."divisionId"
    WHERE       d."tournamentId" = $1
        AND     mt."invalidated" = FALSE
`;

/** Each of those songs once, by title, which is how the lobby names a song. */
const ACTIVE_TOURNAMENT_SONGS = `
    SELECT DISTINCT ON (active_song."title")
            active_song."id",
            active_song."title"
    FROM (${ACTIVE_TOURNAMENT_SONGS_BASE}) active_song
    ORDER BY active_song."title", active_song."id"
`;

/** One of them, for the caller that already knows which song it is asking about. */
const ACTIVE_TOURNAMENT_SONG = `
    SELECT  active_song."id",
            active_song."title"
    FROM (${ACTIVE_TOURNAMENT_SONGS_BASE}) active_song
    WHERE   active_song."id" = $2
    LIMIT   1
`;

/** Whether a match exists. The row carries nothing; only its presence is read. */
const MATCH_EXISTS = `
    SELECT  1
    FROM    "match" m
    WHERE   m."id" = $1
`;

function projectedResultState(row: MatchRow, rules: AdvancementRuleDto[]): MatchResultStateDto {
    if (row.matchResultId !== null) {
        return { status: 'completed', entries: row.matchResultPlayerPoints ?? [], ambiguousTies: [] };
    }

    const playerIds = row.entrants
        .filter((entrant) => entrant.type === 'player')
        .map((entrant) => entrant.participants?.[0]?.player?.id)
        .filter((playerId): playerId is number => Boolean(playerId));
    if (playerIds.length === 0 || row.rounds.length === 0) {
        return { status: 'incomplete', entries: [], ambiguousTies: [] };
    }

    const settled = row.rounds.every((round) => round.song
        ? playerIds.every((playerId) => round.standings.some((standing) => standing.player.id === playerId))
        : round.standings.some((standing) => standing.points > 0));
    if (!settled) return { status: 'incomplete', entries: [], ambiguousTies: [] };

    const points = playerIds.map((playerId) => ({
        playerId,
        points: row.rounds.reduce((total, round) =>
            total + (round.standings.find((standing) => standing.player.id === playerId)?.points ?? 0), 0),
    }));
    const tiebreaks = row.tiebreaks.map((tiebreak) => ({
        id: tiebreak.id,
        sequence: tiebreak.sequence,
        invalidated: tiebreak.invalidated,
        complete: tiebreak.standings.length >= 2 && (tiebreak.song
            ? tiebreak.standings.every((standing) => Boolean(standing.score))
            : tiebreak.standings.every((standing) => standing.manualPoints !== null)),
        entries: tiebreak.standings.map((standing) => ({
            playerId: standing.player.id,
            value: tiebreak.song ? Number(standing.score?.percentage ?? 0) : standing.manualPoints,
            isFailed: tiebreak.song ? standing.score?.isFailed ?? null : null,
        })),
    }));
    const resolution = resolvePlacements(
        points,
        tiebreaks,
        rules.filter((rule) => rule.sourceKind === 'match' && rule.sourceId === row.id),
    );

    return {
        status: resolution.ambiguousTies.length > 0 ? 'tiebreak_required' : 'ready',
        ...resolution,
    };
}

/**
 * A row as a list reads it.
 *
 * The runs still missing are the places the song rounds hold minus the
 * standings recorded on them, which holds while a standing belongs to a player
 * the match holds — the only way one is written. It is clamped, so a standing
 * left behind by a player removed from the match reads as nothing missing
 * rather than as a negative.
 */
function toSummary(row: MatchSummaryRow, incomingRules: AdvancementRuleDto[]): MatchSummaryDto {
    const entrants = row.entrants ?? [];
    const playerCount = entrants.filter((entrant) => entrant.player !== null).length;
    const songCount = Number(row.songCount);

    return {
        id: row.id,
        name: row.name,
        subtitle: row.subtitle,
        active: row.active,
        state: row.state,
        phaseGroupId: row.phaseGroupId,
        entrants,
        incomingRules,
        songCount,
        handScored: row.handScored,
        missingScoreCount: Math.max(0, songCount * playerCount - Number(row.scoredCount)),
        tiebreakInProgress: row.tiebreakInProgress,
        winner: row.winner,
    };
}

/**
 * Every read of a match, at the level its reader asked for.
 *
 * It projects and nothing else: it does not write, does not publish, and does
 * not call a service. Two queries answer a request whatever its size and
 * whatever its level — the matches in scope, then the advancement rules of all
 * of them at once.
 *
 * The two levels share the scopes and the mapper file rather than the shape:
 * `MatchDto` is what a card opens, `MatchSummaryDto` is what a list draws, and
 * `Backend.md` says which reader is entitled to which.
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

    /**
     * A named set of matches, for the callers that already know which ones they
     * are answering about. The schedule page reads its entries this way rather
     * than projecting every match of the tournament to resolve a handful.
     */
    async byIds(ids: number[]): Promise<MatchDto[]> {
        if (ids.length === 0) return [];

        return await this.inScope('ids', ids);
    }

    /**
     * The same set of matches at the Summary level, for the readers that draw a
     * list of them. The schedule board, the Control Room queue and the pickers
     * of the schedule editor all come through here.
     */
    async summariesByIds(ids: number[]): Promise<MatchSummaryDto[]> {
        if (ids.length === 0) return [];

        return await this.summariesInScope('ids', ids);
    }

    async byPhaseGroup(phaseGroupId: number): Promise<MatchDto[]> {
        return await this.inScope('phaseGroup', phaseGroupId);
    }

    async byDivision(divisionId: number): Promise<MatchDto[]> {
        return await this.inScope('division', divisionId);
    }

    async byTournament(tournamentId: number): Promise<MatchDto[]> {
        return await this.inScope('tournament', tournamentId);
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
        const rows: ActiveSongRow[] = await this.dataSource.query(ACTIVE_TOURNAMENT_SONGS, [tournamentId]);

        return rows;
    }

    async activeSongForTournament(tournamentId: number, songId: number): Promise<SongRefDto | null> {
        const rows: ActiveSongRow[] = await this.dataSource.query(ACTIVE_TOURNAMENT_SONG, [tournamentId, songId]);

        return rows[0] ?? null;
    }

    /** Whether a match exists, for the callers that only need to refuse when it does not. */
    async exists(id: number): Promise<boolean> {
        const rows: unknown[] = await this.dataSource.query(MATCH_EXISTS, [id]);

        return rows.length > 0;
    }

    private async summariesInScope(scope: MatchScope, id: number | number[]): Promise<MatchSummaryDto[]> {
        const rows: MatchSummaryRow[] = await this.dataSource.query(MATCH_SUMMARIES_IN_SCOPE[scope], [id]);
        if (rows.length === 0) return [];

        const rules = await this.incomingAdvancementRulesOf(rows.map((row) => row.id));

        return rows.map((row) => toSummary(row, rules.get(row.id) ?? []));
    }

    private async inScope(scope: MatchScope, id: number | number[]): Promise<MatchDto[]> {
        const rows: MatchRow[] = await this.dataSource.query(MATCHES_IN_SCOPE[scope], [id]);
        if (rows.length === 0) return [];

        const rules = await this.advancementRulesOf(rows.map((row) => row.id));

        return rows.map((row) => {
            const matchRules = rules.get(row.id) ?? [];
            return {
            id: row.id,
            name: row.name,
            subtitle: row.subtitle,
            notes: row.notes,
            scoringSystem: row.scoringSystem,
            active: row.active,
            state: row.state,
            entrants: row.entrants,
            rounds: row.rounds,
            tiebreaks: row.tiebreaks,
            advancementRules: matchRules,
            resultState: projectedResultState(row, matchRules),
            matchResult: row.matchResultId === null
                ? null
                : { id: row.matchResultId, playerPoints: row.matchResultPlayerPoints ?? [] },
            phaseGroupId: row.phaseGroupId,
            };
        });
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

    private async incomingAdvancementRulesOf(matchIds: number[]): Promise<Map<number, AdvancementRuleDto[]>> {
        const rows: AdvancementRuleRow[] = await this.dataSource.query(INCOMING_ADVANCEMENT_RULES_FOR_MATCHES, [matchIds]);
        const byMatch = new Map<number, AdvancementRuleDto[]>();

        for (const rule of rows) {
            this.append(byMatch, rule.targetId, rule);
        }

        return byMatch;
    }

    private append(byMatch: Map<number, AdvancementRuleDto[]>, matchId: number, rule: AdvancementRuleDto): void {
        const rules = byMatch.get(matchId);
        if (rules) rules.push(rule);
        else byMatch.set(matchId, [rule]);
    }
}
