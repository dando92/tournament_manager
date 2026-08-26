import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PhaseGroupEntrantDto } from '@tournament-manager/contracts';

import { PhaseGroupAddress } from '@tournament/structure/phase-group/phase-group.aggregate';

/** The rows `ENTRANTS_OF_PHASE_GROUP` produces. Changing one without the other is a bug. */
type PhaseGroupEntrantRow = PhaseGroupEntrantDto;

/**
 * Who competes in a pool.
 *
 * Two things put somebody here and they are not the same thing. A **seat** is
 * what the pool decided: the order a bracket was built in, or a placement an
 * advancement rule produced, and that is the row in `phase_group_entrant`.
 * Playing in a match of this pool is the other, and it is derived — it was
 * copied into a seat row by a `syncDerivedEntrants` that every match write had
 * to remember to call, and it is a `NOT EXISTS` away from being read instead.
 *
 * The two are one list here, and each branch is asked of the pool rather than
 * of the entrant table: the seats through `phase_group_entrant`, the derived
 * ones through the pool's own matches. Written as one scan of `entrant` with
 * the two tests `OR`ed together, it had no predicate the planner could use, so
 * it read every entrant in the installation to answer about one pool.
 *
 * A seated entrant comes first in seeded order; a derived one has no seat, so
 * it sorts after every seated one by the seed its division gave it and then by
 * name, which is the order the copies used to be assigned their slots in.
 */
const ENTRANTS_OF_PHASE_GROUP = `
    SELECT  member."seedNum"        AS "seedNum",
            member."slot"           AS "slot",
            member."status"         AS "status",
            json_build_object(
                'id', member."entrantId",
                'name', member."name",
                'type', member."type",
                'status', member."entrantStatus",
                'participants', COALESCE(participants."json", '[]'::json)
            )                       AS "entrant"
    FROM (
        SELECT  seat."seedNum"      AS "seedNum",
                seat."slot"         AS "slot",
                seat."status"       AS "status",
                e."id"              AS "entrantId",
                e."name"            AS "name",
                e."type"            AS "type",
                e."status"          AS "entrantStatus",
                e."seedNum"         AS "divisionSeedNum"
        FROM    "phase_group_entrant" seat
        JOIN    "entrant" e ON e."id" = seat."entrantId"
        WHERE   seat."phaseGroupId" = $1

        UNION ALL

        SELECT  DISTINCT
                NULL::int           AS "seedNum",
                NULL::int           AS "slot",
                'active'            AS "status",
                e."id"              AS "entrantId",
                e."name"            AS "name",
                e."type"            AS "type",
                e."status"          AS "entrantStatus",
                e."seedNum"         AS "divisionSeedNum"
        FROM    "match" m
        JOIN    "match_entrants_entrant" me ON me."matchId" = m."id"
        JOIN    "entrant" e ON e."id" = me."entrantId"
        WHERE   m."phaseGroupId" = $1
            AND NOT EXISTS (
                SELECT  1
                FROM    "phase_group_entrant" seat
                WHERE   seat."entrantId" = e."id" AND seat."phaseGroupId" = $1
            )
    ) member
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
        WHERE   ep."entrantId" = member."entrantId"
    ) participants ON TRUE
    ORDER BY member."seedNum" ASC NULLS LAST, member."divisionSeedNum" ASC NULLS LAST, LOWER(member."name"), member."entrantId"
`;

/** The rows `ADDRESS_OF_PHASE_GROUP` produces. */
type PhaseGroupAddressRow = PhaseGroupAddress;

/**
 * Where a pool sits, for the writes that have to announce one without loading
 * it. An advancement rule is the only such write: it is an edge between two
 * competitions rather than a change to either, so it has no aggregate to load
 * and no address in hand.
 *
 * `competition_address` is the walk up to the tournament, written once in a
 * migration rather than in each of the queries that took it. A pool appears in
 * it once per match and once on its own when it has none, so one row is asked
 * for.
 */
const ADDRESS_OF_PHASE_GROUP = `
    SELECT  ca."tournamentId" AS "tournamentId",
            ca."divisionId"   AS "divisionId",
            ca."phaseId"      AS "phaseId",
            ca."phaseGroupId" AS "phaseGroupId"
    FROM    "competition_address" ca
    WHERE   ca."phaseGroupId" = $1
    LIMIT   1
`;

/** The same address, reached from a match: the pool a match belongs to. */
const ADDRESS_OF_MATCH_POOL = `
    SELECT  ca."tournamentId" AS "tournamentId",
            ca."divisionId"   AS "divisionId",
            ca."phaseId"      AS "phaseId",
            ca."phaseGroupId" AS "phaseGroupId"
    FROM    "competition_address" ca
    WHERE   ca."matchId" = $1
`;

/** Whether a pool exists. The row carries nothing; only its presence is read. */
const PHASE_GROUP_EXISTS = `
    SELECT  1
    FROM    "phase_group" pg
    WHERE   pg."id" = $1
`;

/**
 * The first pool of a phase. The start.gg import puts a set whose pool it
 * cannot place into the phase's own pool rather than inventing one.
 */
const DEFAULT_PHASE_GROUP_OF_PHASE = `
    SELECT   pg."id" AS "id"
    FROM     "phase_group" pg
    WHERE    pg."phaseId" = $1
    ORDER BY pg."id" ASC
    LIMIT    1
`;

/** Every read of a pool that is not part of the tree. */
@Injectable()
export class PhaseGroupQueries {
    constructor(
        @InjectDataSource()
        private readonly dataSource: DataSource,
    ) {}

    async entrants(phaseGroupId: number): Promise<PhaseGroupEntrantDto[]> {
        const rows: PhaseGroupEntrantRow[] = await this.dataSource.query(ENTRANTS_OF_PHASE_GROUP, [phaseGroupId]);

        return rows;
    }

    async address(phaseGroupId: number): Promise<PhaseGroupAddress | null> {
        const rows: PhaseGroupAddressRow[] = await this.dataSource.query(ADDRESS_OF_PHASE_GROUP, [phaseGroupId]);

        return rows[0] ?? null;
    }

    async addressOfMatchPool(matchId: number): Promise<PhaseGroupAddress | null> {
        const rows: PhaseGroupAddressRow[] = await this.dataSource.query(ADDRESS_OF_MATCH_POOL, [matchId]);

        return rows[0] ?? null;
    }

    /**
     * Whether a pool exists. The routes that name one as an advancement source
     * answer `404` for one that does not, which an empty list cannot say.
     */
    async exists(phaseGroupId: number): Promise<boolean> {
        const rows: unknown[] = await this.dataSource.query(PHASE_GROUP_EXISTS, [phaseGroupId]);

        return rows.length > 0;
    }

    /** The pool a phase's own sets belong to. */
    async defaultForPhase(phaseId: number): Promise<number | null> {
        const rows: Array<{ id: number }> = await this.dataSource.query(DEFAULT_PHASE_GROUP_OF_PHASE, [phaseId]);

        return rows[0]?.id ?? null;
    }
}
