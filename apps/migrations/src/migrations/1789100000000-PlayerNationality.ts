import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Moves nationality from the account to the player, and gives it a formalism.
 *
 * It was on the account, which is the login. Nationality belongs to the
 * competitor, and most competitors have no login: a walk-up entrant is a player
 * with no account at all, so on the account the field was unreachable for
 * exactly the people a start list wants to show it for.
 *
 * The value was also free text — a demonym chosen from a list of them,
 * "Italian", "Japanese". A flag is keyed by a country, so the column is now ISO
 * 3166-1 alpha-2 and the check enforces it. The old values cannot be mapped
 * without deciding what "Bosnian" or "Congolese" resolves to, and the column
 * was edited on one screen that no deployment has used in anger, so they are
 * carried over only where they already were a code and dropped otherwise.
 */
export class PlayerNationality1789100000000 implements MigrationInterface {
    name = "PlayerNationality1789100000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "player" ADD "nationality" character varying(2) NOT NULL DEFAULT ''`);
        await queryRunner.query(`
            UPDATE "player" p
            SET    "nationality" = UPPER(a."nationality")
            FROM   "account" a
            WHERE  a."playerId" = p."id" AND a."nationality" ~ '^[A-Za-z]{2}$'
        `);
        await queryRunner.query(`ALTER TABLE "player" ADD CONSTRAINT "CHK_player_nationality" CHECK ("nationality" = '' OR "nationality" ~ '^[A-Z]{2}$')`);
        await queryRunner.query(`ALTER TABLE "account" DROP COLUMN "nationality"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "account" ADD "nationality" character varying NOT NULL DEFAULT ''`);
        await queryRunner.query(`
            UPDATE "account" a
            SET    "nationality" = p."nationality"
            FROM   "player" p
            WHERE  a."playerId" = p."id"
        `);
        await queryRunner.query(`ALTER TABLE "player" DROP CONSTRAINT "CHK_player_nationality"`);
        await queryRunner.query(`ALTER TABLE "player" DROP COLUMN "nationality"`);
    }
}
