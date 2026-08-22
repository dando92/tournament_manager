import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A standing becomes the points of one player in one round.
 *
 * The player was only reachable through the score, which is what made a
 * standing impossible without one, and therefore made a hand-scored match
 * impossible to express at all. Moving it onto the standing is what lets a
 * round exist without a song and still say who scored what.
 *
 * The three indexes state rules the code has been assuming: one standing per
 * player per round, a song at most once per match, and at most one hand-scored
 * round per match. Their names are the ones TypeORM derives from the entities,
 * so the schema this migration builds matches the metadata exactly.
 */
export class StandingOwnsPlayer1787700000000 implements MigrationInterface {
  name = 'StandingOwnsPlayer1787700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "standing" ADD "playerId" integer`);
    await queryRunner.query(
      `UPDATE "standing" s SET "playerId" = sc."playerId" FROM "score" sc WHERE sc."id" = s."scoreId"`,
    );
    /* A standing whose score never resolved to a player carries no information
       any more and cannot satisfy the constraint below. */
    await queryRunner.query(`DELETE FROM "standing" WHERE "playerId" IS NULL`);
    await queryRunner.query(`ALTER TABLE "standing" ALTER COLUMN "playerId" SET NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "standing" ADD CONSTRAINT "FK_247c99355e4604a24fbe04b507d" FOREIGN KEY ("playerId") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_76a9cb5154ea8d65024989a39e" ON "standing" ("roundId", "playerId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_dfa041d32ed2f7a150188a2da7" ON "round" ("matchId", "songId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_9df0a40a5d3842afc294a88e83" ON "round" ("matchId") WHERE "songId" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_9df0a40a5d3842afc294a88e83"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_dfa041d32ed2f7a150188a2da7"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_76a9cb5154ea8d65024989a39e"`);
    await queryRunner.query(`ALTER TABLE "standing" DROP CONSTRAINT "FK_247c99355e4604a24fbe04b507d"`);
    await queryRunner.query(`ALTER TABLE "standing" DROP COLUMN "playerId"`);
  }
}
