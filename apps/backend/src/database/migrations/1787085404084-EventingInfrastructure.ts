import { MigrationInterface, QueryRunner } from 'typeorm';

export class EventingInfrastructure1787085404084 implements MigrationInterface {
  name = 'EventingInfrastructure1787085404084';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "event_outbox" (
        "id" uuid NOT NULL,
        "event_type" character varying NOT NULL,
        "event_version" integer NOT NULL,
        "aggregate_id" character varying NOT NULL,
        "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "correlation_id" uuid NOT NULL,
        "causation_id" uuid,
        "payload" jsonb NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "published_at" TIMESTAMP WITH TIME ZONE,
        "publish_attempts" integer NOT NULL DEFAULT 0,
        "last_error" text,
        CONSTRAINT "PK_event_outbox" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_event_outbox_pending" ON "event_outbox" ("created_at") WHERE "published_at" IS NULL`,
    );
    await queryRunner.query(`
      CREATE TABLE "event_inbox" (
        "consumer" character varying NOT NULL,
        "event_id" uuid NOT NULL,
        "event_type" character varying NOT NULL,
        "correlation_id" uuid NOT NULL,
        "processed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_event_inbox" PRIMARY KEY ("consumer", "event_id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "tournament_event_projection" (
        "tournament_id" integer NOT NULL,
        "created_event_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "projected_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tournament_event_projection" PRIMARY KEY ("tournament_id"),
        CONSTRAINT "UQ_tournament_event_projection_event" UNIQUE ("created_event_id"),
        CONSTRAINT "FK_tournament_event_projection_tournament" FOREIGN KEY ("tournament_id") REFERENCES "tournament"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tournament_event_projection"`);
    await queryRunner.query(`DROP TABLE "event_inbox"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_event_outbox_pending"`);
    await queryRunner.query(`DROP TABLE "event_outbox"`);
  }
}
