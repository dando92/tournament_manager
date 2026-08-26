import { MigrationInterface, QueryRunner } from "typeorm";

/** Adds match-owned tiebreak attempts and explicit result placements. */
export class MatchTiebreaks1788400000000 implements MigrationInterface {
    name = "MatchTiebreaks1788400000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "match_tiebreak" (
            "id" SERIAL NOT NULL,
            "sequence" integer NOT NULL,
            "invalidated" boolean NOT NULL DEFAULT false,
            "matchId" integer NOT NULL,
            "songId" integer,
            CONSTRAINT "PK_match_tiebreak" PRIMARY KEY ("id"),
            CONSTRAINT "UQ_match_tiebreak_sequence" UNIQUE ("matchId", "sequence"),
            CONSTRAINT "FK_match_tiebreak_match" FOREIGN KEY ("matchId") REFERENCES "match"("id") ON DELETE CASCADE,
            CONSTRAINT "FK_match_tiebreak_song" FOREIGN KEY ("songId") REFERENCES "song"("id") ON DELETE CASCADE
        )`);
        await queryRunner.query(`CREATE TABLE "match_tiebreak_standing" (
            "id" SERIAL NOT NULL,
            "manualPoints" integer,
            "tiebreakId" integer NOT NULL,
            "playerId" integer NOT NULL,
            "scoreId" integer,
            CONSTRAINT "PK_match_tiebreak_standing" PRIMARY KEY ("id"),
            CONSTRAINT "UQ_match_tiebreak_standing_player" UNIQUE ("tiebreakId", "playerId"),
            CONSTRAINT "UQ_match_tiebreak_standing_score" UNIQUE ("scoreId"),
            CONSTRAINT "FK_match_tiebreak_standing_tiebreak" FOREIGN KEY ("tiebreakId") REFERENCES "match_tiebreak"("id") ON DELETE CASCADE,
            CONSTRAINT "FK_match_tiebreak_standing_player" FOREIGN KEY ("playerId") REFERENCES "player"("id") ON DELETE CASCADE,
            CONSTRAINT "FK_match_tiebreak_standing_score" FOREIGN KEY ("scoreId") REFERENCES "score"("id")
        )`);
        await queryRunner.query(`UPDATE "match_result" result
            SET "playerPoints" = (
                SELECT json_agg(entry.value || jsonb_build_object('placement', entry.ordinality) ORDER BY entry.ordinality)::text
                FROM jsonb_array_elements(result."playerPoints"::jsonb) WITH ORDINALITY AS entry(value, ordinality)
            )`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`UPDATE "match_result" result
            SET "playerPoints" = (
                SELECT json_agg(entry.value - 'placement' ORDER BY entry.ordinality)::text
                FROM jsonb_array_elements(result."playerPoints"::jsonb) WITH ORDINALITY AS entry(value, ordinality)
            )`);
        await queryRunner.query(`DROP TABLE "match_tiebreak_standing"`);
        await queryRunner.query(`DROP TABLE "match_tiebreak"`);
    }
}
