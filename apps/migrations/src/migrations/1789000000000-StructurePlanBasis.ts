import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * What a structure plan is checked against, and what keeps a link unique.
 *
 * `structureVersion` counts the changes to a division's shape, so a plan
 * computed against one version and applied against another is refused rather
 * than written against rows that may have moved. Nothing could serve before
 * this: no entity in the schema carries an update timestamp.
 *
 * `external_mapping` has always identified a row by provider, local type and
 * id, external type and id, and has never said so: the table carried only a
 * surrogate key, so nothing stopped a repeated import from claiming the same
 * mapping twice. Duplicates are removed keeping the lowest id, because the
 * rows are identical by definition of the key.
 */
export class StructurePlanBasis1789000000000 implements MigrationInterface {
    name = "StructurePlanBasis1789000000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "division" ADD "structureVersion" integer NOT NULL DEFAULT 0`);

        await queryRunner.query(`
            DELETE FROM "external_mapping" a
            USING "external_mapping" b
            WHERE a."id" > b."id"
              AND a."provider" = b."provider"
              AND a."localType" = b."localType"
              AND a."localId" = b."localId"
              AND a."externalType" = b."externalType"
              AND a."externalId" = b."externalId"
        `);
        await queryRunner.query(
            `CREATE UNIQUE INDEX "UQ_external_mapping_identity" ON "external_mapping" ("provider", "localType", "localId", "externalType", "externalId")`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "UQ_external_mapping_identity"`);
        await queryRunner.query(`ALTER TABLE "division" DROP COLUMN "structureVersion"`);
    }
}
