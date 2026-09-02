import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EntrantDto, ParticipantDto } from '@tournament-manager/contracts';

/** The rows `ENTRANTS_OF_DIVISION` produces. Changing one without the other is a bug. */
type EntrantRow = EntrantDto;

/**
 * The roster of a division, in seeded order.
 *
 * The participants of an entrant are aggregated into JSON in the database
 * against the field names of `ParticipantDto`, the way `MatchQueries` builds the
 * same shape, so one entrant stays one row and the mapper is a copy.
 *
 * An unseeded entrant sorts after every seeded one and then by name, which is
 * what the previous in-memory sort did with `Number.MAX_SAFE_INTEGER` as its
 * missing value.
 */
const ENTRANTS_OF_DIVISION = `
    SELECT  e."id"     AS "id",
            e."name"   AS "name",
            e."type"   AS "type",
            e."status" AS "status",
            COALESCE(participants."json", '[]'::json) AS "participants"
    FROM        "entrant" e
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
    WHERE    e."divisionId" = $1
    ORDER BY e."seedNum" ASC NULLS LAST, LOWER(e."name"), e."id"
`;

/** The rows `AVAILABLE_PARTICIPANTS_OF_DIVISION` produces. */
type AvailableParticipantRow = ParticipantDto;

/**
 * Everybody in the tournament who does not yet compete in this division.
 *
 * Only an **active** entrant occupies a participant. Removing somebody from a
 * division withdraws their entrant rather than deleting it, and adding them
 * back reactivates that same row, so a withdrawn participant has to be offered
 * again — otherwise a removal is irreversible from the interface, which is what
 * it was.
 *
 * The order is the order the participants were registered in, because that is
 * the order the roster tab lists everybody in: the two lists it merges have to
 * agree on it, and a participant id is the registration order.
 *
 * This was the most expensive read left in the structure routes: it loaded the
 * division, its tournament, every participant of that tournament with its
 * player and account, and every entrant of the division with its participants,
 * then subtracted one set from the other in JavaScript. The subtraction is a
 * `NOT EXISTS` against the join table.
 */
const AVAILABLE_PARTICIPANTS_OF_DIVISION = `
    SELECT  pa."id"     AS "id",
            to_json(pa."roles") AS "roles",
            pa."status" AS "status",
            json_build_object('id', pl."id", 'playerName', pl."playerName") AS "player"
    FROM    "participant" pa
    JOIN    "player" pl ON pl."id" = pa."playerId"
    JOIN    "division" d ON d."id" = $1 AND d."tournamentId" = pa."tournamentId"
    WHERE   NOT EXISTS (
        SELECT  1
        FROM    "entrant_participants_participant" ep
        JOIN    "entrant" e ON e."id" = ep."entrantId"
        WHERE   ep."participantId" = pa."id"
            AND e."divisionId" = $1
            AND e."status" = 'active'
    )
    ORDER BY pa."id"
`;

/**
 * Which tournament a division belongs to. The registration routes reach the
 * tournament before they reach the division, because a player is registered as
 * a participant of the tournament first.
 */
const TOURNAMENT_ID_OF_DIVISION = `
    SELECT  d."tournamentId" AS "tournamentId"
    FROM    "division" d
    WHERE   d."id" = $1
`;

/** Whether a division exists. The row carries nothing; only its presence is read. */
const DIVISION_EXISTS = `
    SELECT  1
    FROM    "division" d
    WHERE   d."id" = $1
`;

/**
 * Every read of a division's roster.
 *
 * The structure below a division — its phases and pools — is read through
 * `TreeQueries`, its running totals through `StandingsQueries`, and its matches
 * through `MatchQueries`.
 */
@Injectable()
export class DivisionQueries {
    constructor(
        @InjectDataSource()
        private readonly dataSource: DataSource,
    ) {}

    async entrants(divisionId: number): Promise<EntrantDto[]> {
        const rows: EntrantRow[] = await this.dataSource.query(ENTRANTS_OF_DIVISION, [divisionId]);

        return rows;
    }

    async availableParticipants(divisionId: number): Promise<ParticipantDto[]> {
        const rows: AvailableParticipantRow[] = await this.dataSource.query(AVAILABLE_PARTICIPANTS_OF_DIVISION, [divisionId]);

        return rows;
    }

    /** Which tournament a division belongs to. */
    async tournamentIdOf(divisionId: number): Promise<number | null> {
        const rows: Array<{ tournamentId: number | null }> = await this.dataSource.query(TOURNAMENT_ID_OF_DIVISION, [divisionId]);

        return rows[0]?.tournamentId ?? null;
    }

    /**
     * Whether a division exists. Its three read routes answer `404` for one that
     * does not, which an empty collection cannot say on its own.
     */
    async exists(divisionId: number): Promise<boolean> {
        const rows: unknown[] = await this.dataSource.query(DIVISION_EXISTS, [divisionId]);

        return rows.length > 0;
    }
}
