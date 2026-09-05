import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ParticipantDto, ParticipantImportPreviewRowDto, PlayerRefDto } from '@tournament-manager/contracts';

/** The rows `PARTICIPANTS_OF_TOURNAMENT` produces. Changing one without the other is a bug. */
type ParticipantRow = ParticipantDto;

/**
 * Everybody registered in a tournament, ordered by the name they compete under.
 */
const PARTICIPANTS_OF_TOURNAMENT = `
    SELECT  pa."id"     AS "id",
            to_json(pa."roles") AS "roles",
            pa."status" AS "status",
            json_build_object('id', pl."id", 'playerName', pl."playerName", 'nationality', pl."nationality") AS "player"
    FROM    "participant" pa
    JOIN    "player" pl ON pl."id" = pa."playerId"
    WHERE   pa."tournamentId" = $1
    ORDER BY LOWER(pl."playerName"), pa."id"
`;

/** The rows `IMPORT_PREVIEW_OF_NAMES` produces. */
type ImportPreviewRow = {
    name: string;
    playerId: number | null;
    playerName: string | null;
    nationality: string | null;
    alreadyParticipant: boolean;
};

/**
 * What importing a list of names would do, as one join rather than a scan.
 *
 * The previous form loaded every player in the system, built a map keyed by the
 * normalized name and looked each requested name up in it. The names arrive as
 * an array parameter and keep their order through `WITH ORDINALITY`, so the
 * response rows still line up with the list the client sent.
 *
 * A name matches at most one player, and now says so: `UQ_player_normalized_name`
 * makes the normalized name unique, so the lateral no longer has to pick the
 * older of two rows it should never have seen (FQ-029).
 */
const IMPORT_PREVIEW_OF_NAMES = `
    WITH requested AS (
        SELECT  "name", "ordinality"
        FROM    unnest($2::text[]) WITH ORDINALITY AS t("name", "ordinality")
    )
    SELECT  r."name"             AS "name",
            matched."id"         AS "playerId",
            matched."playerName" AS "playerName",
            matched."nationality" AS "nationality",
            EXISTS (
                SELECT  1
                FROM    "participant" pa
                WHERE   pa."tournamentId" = $1 AND pa."playerId" = matched."id"
            )                    AS "alreadyParticipant"
    FROM        requested r
    LEFT JOIN   "player" matched ON LOWER(TRIM(matched."playerName")) = LOWER(TRIM(r."name"))
    ORDER BY r."ordinality"
`;

/** The rows `PLAYERS_OF_TOURNAMENT_BY_NAME` produce. */
type NamedPlayerRow = { normalizedName: string; playerId: number };

/**
 * Who a lobby is naming: the players of this tournament's roster whose names
 * match the ones a completed song reported.
 *
 * A lobby knows people by the name shown on the cabinet, so the join is on the
 * normalized name, and it is asked once for a whole lobby rather than once per
 * score. Somebody who is not registered in this tournament is not matched, which
 * is what makes the run a warning rather than a score against a stranger.
 *
 * One name is one player — `UQ_player_normalized_name` — and one person takes
 * part in a tournament once — `UQ_participant_tournament_player` — so the row
 * per name is unique without a `DISTINCT ON` to make it so.
 */
const PLAYERS_OF_TOURNAMENT_BY_NAME = `
    SELECT   LOWER(TRIM(pl."playerName")) AS "normalizedName",
             pl."id"                      AS "playerId"
    FROM     "participant" pa
    JOIN     "player" pl ON pl."id" = pa."playerId"
    WHERE    pa."tournamentId" = $1
        AND  LOWER(TRIM(pl."playerName")) = ANY($2::text[])
`;

/** The rows `DIVISIONS_OF_PARTICIPANT` produces. */
type DivisionRow = { divisionId: number };

/**
 * Which divisions somebody competes in, for the write that takes them out of a
 * tournament: an entrant belongs to the division that admitted it, so each of
 * them has to withdraw the person before the participant row can go.
 *
 * One row per division rather than per entrant — somebody belongs to a division
 * once, and asking for the distinct set here is what keeps the caller from
 * looping over entrants.
 */
const DIVISIONS_OF_PARTICIPANT = `
    SELECT DISTINCT d."id" AS "divisionId"
    FROM    "entrant_participants_participant" ep
    JOIN    "entrant" e ON e."id" = ep."entrantId"
    JOIN    "division" d ON d."id" = e."divisionId"
    WHERE   ep."participantId" = $2 AND d."tournamentId" = $1
    ORDER BY d."id"
`;

/**
 * Whether an account may edit a tournament. Owning it and staffing it are the
 * same permission, so one row of either role answers the question and nothing
 * from that row is read.
 *
 * `roles` is a native array, so the overlap is an operator on the column rather
 * than on a value computed from it, and the GIN index can serve it.
 */
const PARTICIPANT_CAN_EDIT = `
    SELECT  1
    FROM    "participant" pa
    WHERE   pa."tournamentId" = $1
        AND pa."accountId" = $2
        AND pa."roles" && ARRAY['owner', 'staff']
    LIMIT   1
`;

/**
 * Every read of who takes part in a tournament.
 *
 * It projects and nothing else: it does not write, does not publish, and does
 * not call a service. The write paths call `forTournament` for their response,
 * so a mutation answers with the projection its `GET` returns.
 */
@Injectable()
export class ParticipantQueries {
    constructor(
        @InjectDataSource()
        private readonly dataSource: DataSource,
    ) {}

    async forTournament(tournamentId: number): Promise<ParticipantDto[]> {
        const rows: ParticipantRow[] = await this.dataSource.query(PARTICIPANTS_OF_TOURNAMENT, [tournamentId]);

        return rows;
    }

    async divisionsOf(tournamentId: number, participantId: number): Promise<number[]> {
        const rows: DivisionRow[] = await this.dataSource.query(DIVISIONS_OF_PARTICIPANT, [tournamentId, participantId]);

        return rows.map((row) => row.divisionId);
    }

    /**
     * The players of the roster these names stand for, keyed by the normalized
     * name the caller asked with.
     */
    async playerIdsByNames(tournamentId: number, playerNames: string[]): Promise<Map<string, number>> {
        const normalized = [...new Set(playerNames.map((name) => name.trim().toLowerCase()).filter(Boolean))];
        if (normalized.length === 0) return new Map();

        const rows: NamedPlayerRow[] = await this.dataSource.query(PLAYERS_OF_TOURNAMENT_BY_NAME, [tournamentId, normalized]);

        return new Map(rows.map((row) => [row.normalizedName, row.playerId]));
    }

    /**
     * Whether an account may edit a tournament. Owning it or staffing it is the
     * same permission; the guards ask the same question of the same rows.
     */
    async canEdit(tournamentId: number, accountId: string): Promise<boolean> {
        const rows: unknown[] = await this.dataSource.query(PARTICIPANT_CAN_EDIT, [tournamentId, accountId]);

        return rows.length > 0;
    }

    /**
     * One row per distinct name, in the order the client listed them. A name is
     * distinct by its trimmed form, which is what the import itself writes;
     * matching a player ignores case as well.
     */
    async importPreview(tournamentId: number, playerNames: string[]): Promise<ParticipantImportPreviewRowDto[]> {
        const requested = [...new Set(playerNames.map((name) => name.trim()).filter(Boolean))];
        if (requested.length === 0) return [];

        const rows: ImportPreviewRow[] = await this.dataSource.query(IMPORT_PREVIEW_OF_NAMES, [tournamentId, requested]);

        return rows.map((row) => ({
            name: row.name,
            matchedPlayer: this.toPlayerRef(row),
            alreadyParticipant: row.alreadyParticipant,
        }));
    }

    private toPlayerRef(row: ImportPreviewRow): PlayerRefDto | null {
        if (row.playerId === null || row.playerName === null) return null;

        return { id: row.playerId, playerName: row.playerName, nationality: row.nationality ?? '' };
    }
}
