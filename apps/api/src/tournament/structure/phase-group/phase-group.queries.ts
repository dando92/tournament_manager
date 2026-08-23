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
 * The two are one list here. A seated entrant comes first in seeded order; a
 * derived one has no seat, so it sorts after every seated one by the seed its
 * division gave it and then by name, which is the order the copies used to be
 * assigned their slots in.
 */
const ENTRANTS_OF_PHASE_GROUP = `
    SELECT  seat."seedNum"                  AS "seedNum",
            seat."slot"                     AS "slot",
            COALESCE(seat."status", 'active') AS "status",
            json_build_object(
                'id', e."id",
                'name', e."name",
                'type', e."type",
                'status', e."status",
                'participants', COALESCE(participants."json", '[]'::json)
            )                               AS "entrant"
    FROM        "entrant" e
    LEFT JOIN   "phase_group_entrant" seat ON seat."entrantId" = e."id" AND seat."phaseGroupId" = $1
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
    WHERE   seat."id" IS NOT NULL
        OR  EXISTS (
                SELECT  1
                FROM    "match_entrants_entrant" me
                JOIN    "match" m ON m."id" = me."matchId"
                WHERE   me."entrantId" = e."id" AND m."phaseGroupId" = $1
            )
    ORDER BY seat."seedNum" ASC NULLS LAST, e."seedNum" ASC NULLS LAST, LOWER(e."name"), e."id"
`;

/** The rows `ADDRESS_OF_PHASE_GROUP` produces. */
type PhaseGroupAddressRow = PhaseGroupAddress;

/**
 * Where a pool sits, for the writes that have to announce one without loading
 * it. An advancement rule is the only such write: it is an edge between two
 * competitions rather than a change to either, so it has no aggregate to load
 * and no address in hand.
 */
const ADDRESS_OF_PHASE_GROUP = `
    SELECT  d."tournamentId" AS "tournamentId",
            p."divisionId"   AS "divisionId",
            pg."phaseId"     AS "phaseId",
            pg."id"          AS "phaseGroupId"
    FROM    "phase_group" pg
    JOIN    "phase" p ON p."id" = pg."phaseId"
    JOIN    "division" d ON d."id" = p."divisionId"
    WHERE   pg."id" = $1
`;

/** The same address, reached from a match: the pool a match belongs to. */
const ADDRESS_OF_MATCH_POOL = `
    SELECT  d."tournamentId" AS "tournamentId",
            p."divisionId"   AS "divisionId",
            pg."phaseId"     AS "phaseId",
            pg."id"          AS "phaseGroupId"
    FROM    "match" m
    JOIN    "phase_group" pg ON pg."id" = m."phaseGroupId"
    JOIN    "phase" p ON p."id" = pg."phaseId"
    JOIN    "division" d ON d."id" = p."divisionId"
    WHERE   m."id" = $1
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
        const rows: Array<{ id: number }> = await this.dataSource.query(
            'SELECT pg."id" AS "id" FROM "phase_group" pg WHERE pg."id" = $1',
            [phaseGroupId],
        );

        return rows.length > 0;
    }

    /**
     * The first pool of a phase. The start.gg import puts a set whose pool it
     * cannot place into the phase's own pool rather than inventing one.
     */
    async defaultForPhase(phaseId: number): Promise<number | null> {
        const rows: Array<{ id: number }> = await this.dataSource.query(
            'SELECT pg."id" AS "id" FROM "phase_group" pg WHERE pg."phaseId" = $1 ORDER BY pg."id" ASC LIMIT 1',
            [phaseId],
        );

        return rows[0]?.id ?? null;
    }
}
