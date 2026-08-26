import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Gives four columns the type they always held, and states two rules the
 * application only applied in memory.
 *
 * `match_result."playerPoints"` was `text` holding JSON, cast `::json` on every
 * read. `participant."roles"` was a comma-joined `text`, unpacked with
 * `string_to_array` in five queries, each guarded by a `CASE` for the empty
 * string a `simple-array` uses to mean "no element". Both are now the type
 * PostgreSQL has for them, so the reads say what they mean and the guard is
 * gone.
 *
 * `score."percentage"` was an unbounded `numeric`. FQ-028 fixes two decimal
 * places, so `numeric(5, 2)` holds every EX score percentage exactly —
 * `100.00` needs five digits — and rounds anything more precise on the way in.
 *
 * The two unique indexes are rules that existed only as application code.
 * FQ-029 makes a normalized player name unique, which is what the two name
 * lookups assumed while resolving a collision by taking the older row; and one
 * person takes part in a tournament once, which `TournamentStore` enforced by
 * merging roles onto whatever it found in memory. Neither can be created over
 * data that already breaks it, so each is checked first and reports the rows
 * that collide rather than failing on an index name.
 *
 * The composite covers `participant."tournamentId"` as its leading column, so
 * the single-column index that batch B created for it goes.
 *
 * An expression index cannot be declared in entity metadata, so
 * `UQ_player_normalized_name` lives here alone; the schema builder skips
 * indexes over expressions, so nothing proposes to drop it.
 */
export class SchemaAndTypes1788700000000 implements MigrationInterface {
    name = "SchemaAndTypes1788700000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await this.assertNoDuplicatePlayerNames(queryRunner);
        await this.assertNoDuplicateParticipants(queryRunner);

        await queryRunner.query(`ALTER TABLE "match_result" ALTER COLUMN "playerPoints" TYPE jsonb USING "playerPoints"::jsonb`);

        await queryRunner.query(`ALTER TABLE "participant" ALTER COLUMN "roles" DROP DEFAULT`);
        await queryRunner.query(`
            ALTER TABLE "participant"
            ALTER COLUMN "roles" TYPE text[]
            USING (CASE WHEN COALESCE("roles", '') = '' THEN '{}'::text[] ELSE string_to_array("roles", ',') END)
        `);
        await queryRunner.query(`ALTER TABLE "participant" ALTER COLUMN "roles" SET DEFAULT '{unknown}'`);

        await queryRunner.query(`ALTER TABLE "score" ALTER COLUMN "percentage" TYPE numeric(5, 2)`);

        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_player_normalized_name" ON "player" (LOWER(TRIM("playerName")))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_participant_tournament_player" ON "participant" ("tournamentId", "playerId")`);
        await queryRunner.query(`DROP INDEX "IDX_participant_tournament"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_participant_tournament" ON "participant" ("tournamentId")`);
        await queryRunner.query(`DROP INDEX "UQ_participant_tournament_player"`);
        await queryRunner.query(`DROP INDEX "UQ_player_normalized_name"`);

        await queryRunner.query(`ALTER TABLE "score" ALTER COLUMN "percentage" TYPE numeric`);

        await queryRunner.query(`ALTER TABLE "participant" ALTER COLUMN "roles" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "participant" ALTER COLUMN "roles" TYPE text USING array_to_string("roles", ',')`);
        await queryRunner.query(`ALTER TABLE "participant" ALTER COLUMN "roles" SET DEFAULT 'unknown'`);

        await queryRunner.query(`ALTER TABLE "match_result" ALTER COLUMN "playerPoints" TYPE text USING "playerPoints"::text`);
    }

    private async assertNoDuplicatePlayerNames(queryRunner: QueryRunner): Promise<void> {
        const collisions = await queryRunner.query(`
            SELECT   LOWER(TRIM("playerName")) AS "name", array_agg("id" ORDER BY "id") AS "ids"
            FROM     "player"
            GROUP BY LOWER(TRIM("playerName"))
            HAVING   COUNT(*) > 1
            ORDER BY 1
        `);
        if (collisions.length === 0) {
            return;
        }

        const listed = collisions.map((row: { name: string; ids: number[] }) => `"${row.name}" (players ${row.ids.join(", ")})`).join("; ");
        throw new Error(
            `A player name is unique once trimmed and lowercased, and the catalogue already holds ${collisions.length} that are not: ${listed}. ` +
                `Merge or rename them before running this migration.`,
        );
    }

    private async assertNoDuplicateParticipants(queryRunner: QueryRunner): Promise<void> {
        const collisions = await queryRunner.query(`
            SELECT   "tournamentId", "playerId", array_agg("id" ORDER BY "id") AS "ids"
            FROM     "participant"
            GROUP BY "tournamentId", "playerId"
            HAVING   COUNT(*) > 1
            ORDER BY 1, 2
        `);
        if (collisions.length === 0) {
            return;
        }

        const listed = collisions
            .map((row: { tournamentId: number; playerId: number; ids: number[] }) => `tournament ${row.tournamentId} player ${row.playerId} (participants ${row.ids.join(", ")})`)
            .join("; ");
        throw new Error(
            `A person takes part in a tournament once, and ${collisions.length} already do more than once: ${listed}. ` +
                `Merge them before running this migration.`,
        );
    }
}
