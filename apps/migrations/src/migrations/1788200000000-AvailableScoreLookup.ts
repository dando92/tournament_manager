import { MigrationInterface, QueryRunner } from "typeorm";

export class AvailableScoreLookup1788200000000 implements MigrationInterface {
    name = "AvailableScoreLookup1788200000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_score_song_player_id" ON "score" ("songId", "playerId", "id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_score_song_player_id"`);
    }
}
