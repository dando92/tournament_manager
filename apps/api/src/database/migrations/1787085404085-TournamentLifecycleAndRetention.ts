import { MigrationInterface, QueryRunner } from 'typeorm';

export class TournamentLifecycleAndRetention1787085404085 implements MigrationInterface {
  name = 'TournamentLifecycleAndRetention1787085404085';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tournament" ADD "status" character varying NOT NULL DEFAULT 'open'`,
    );
    await queryRunner.query(
      `ALTER TABLE "tournament" ADD "closedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "tournament" ADD "transportPurgedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "tournament" ADD CONSTRAINT "CHK_tournament_status" CHECK ("status" IN ('open', 'closed'))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tournament_retention" ON "tournament" ("closedAt") WHERE "status" = 'closed' AND "transportPurgedAt" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_inbox" ADD "aggregate_id" character varying`,
    );
    await queryRunner.query(
      `UPDATE "event_inbox" i SET "aggregate_id" = o."aggregate_id" FROM "event_outbox" o WHERE o."id" = i."event_id"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_event_inbox_aggregate" ON "event_inbox" ("aggregate_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_event_outbox_aggregate" ON "event_outbox" ("aggregate_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_event_outbox_aggregate"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_event_inbox_aggregate"`);
    await queryRunner.query(
      `ALTER TABLE "event_inbox" DROP COLUMN "aggregate_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_tournament_retention"`);
    await queryRunner.query(
      `ALTER TABLE "tournament" DROP CONSTRAINT "CHK_tournament_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tournament" DROP COLUMN "transportPurgedAt"`,
    );
    await queryRunner.query(`ALTER TABLE "tournament" DROP COLUMN "closedAt"`);
    await queryRunner.query(`ALTER TABLE "tournament" DROP COLUMN "status"`);
  }
}
