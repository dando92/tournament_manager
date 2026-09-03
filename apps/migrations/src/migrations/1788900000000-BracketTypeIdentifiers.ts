import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Gives a stored bracket type the identifier the catalogue now offers.
 *
 * The catalogue used to be keyed on the label a generator returned, so the
 * manual shape was stored as the sentence `First phase only`. And King of the
 * Hill was offered by a generator with an empty body, so a pool carrying that
 * type holds nothing it built (FQ-050); the type is cleared rather than kept,
 * because a pool claiming a shape nothing ever generated is a lie the pool
 * view mode would read.
 */
export class BracketTypeIdentifiers1788900000000 implements MigrationInterface {
    name = "BracketTypeIdentifiers1788900000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`UPDATE "phase_group" SET "bracketType" = 'Manual' WHERE "bracketType" = 'First phase only'`);
        await queryRunner.query(`UPDATE "phase_group" SET "bracketType" = NULL WHERE "bracketType" = 'KingOfTheHill'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`UPDATE "phase_group" SET "bracketType" = 'First phase only' WHERE "bracketType" = 'Manual'`);
    }
}
