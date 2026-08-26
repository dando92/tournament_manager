import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Where a pool, and each of its matches, sits in the tournament.
 *
 * The walk from a match up to the tournament that owns it — `phase_group` to
 * `phase` to `division` — was written out in eight places across four files,
 * and every one of them had to be corrected together. It is one view now.
 *
 * A pool with no matches still has an address, so the match is joined on the
 * left and `matchId` is null for it. Callers that ask by `phaseGroupId` take
 * one row of the pool's own; callers that ask by `matchId` get exactly one.
 *
 * The view is expanded by the planner rather than materialized, so a lookup
 * through it produces the same plan the written-out joins did.
 */
export class CompetitionAddressView1788600000000 implements MigrationInterface {
    name = "CompetitionAddressView1788600000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE VIEW "competition_address" AS
            SELECT      d."tournamentId" AS "tournamentId",
                        ph."divisionId"  AS "divisionId",
                        pg."phaseId"     AS "phaseId",
                        pg."id"          AS "phaseGroupId",
                        m."id"           AS "matchId"
            FROM        "phase_group" pg
            JOIN        "phase" ph ON ph."id" = pg."phaseId"
            JOIN        "division" d ON d."id" = ph."divisionId"
            LEFT JOIN   "match" m ON m."phaseGroupId" = pg."id"
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP VIEW "competition_address"`);
    }
}
