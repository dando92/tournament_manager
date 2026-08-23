import { MigrationInterface, QueryRunner } from "typeorm";

/** Gives persisted scoring strategies names that describe their behaviour. */
export class RenameScoringSystems1787900000000 implements MigrationInterface {
    name = "RenameScoringSystems1787900000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`UPDATE "match" SET "scoringSystem" = 'PlacementPointsWithFailZero' WHERE "scoringSystem" = 'EurocupScoreCalculator'`);
        await queryRunner.query(`UPDATE "match" SET "scoringSystem" = 'RoundWinner' WHERE "scoringSystem" = 'EurocupFinalsScoringSystem'`);
        await queryRunner.query(`UPDATE "tournament" SET "defaultScoringSystem" = 'PlacementPointsWithFailZero' WHERE "defaultScoringSystem" = 'EurocupScoreCalculator'`);
        await queryRunner.query(`UPDATE "tournament" SET "defaultScoringSystem" = 'RoundWinner' WHERE "defaultScoringSystem" = 'EurocupFinalsScoringSystem'`);
        await queryRunner.query(`ALTER TABLE "tournament" ALTER COLUMN "defaultScoringSystem" SET DEFAULT 'PlacementPointsWithFailZero'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tournament" ALTER COLUMN "defaultScoringSystem" SET DEFAULT 'EurocupScoreCalculator'`);
        await queryRunner.query(`UPDATE "tournament" SET "defaultScoringSystem" = 'EurocupScoreCalculator' WHERE "defaultScoringSystem" = 'PlacementPointsWithFailZero'`);
        await queryRunner.query(`UPDATE "tournament" SET "defaultScoringSystem" = 'EurocupFinalsScoringSystem' WHERE "defaultScoringSystem" = 'RoundWinner'`);
        await queryRunner.query(`UPDATE "match" SET "scoringSystem" = 'EurocupScoreCalculator' WHERE "scoringSystem" = 'PlacementPointsWithFailZero'`);
        await queryRunner.query(`UPDATE "match" SET "scoringSystem" = 'EurocupFinalsScoringSystem' WHERE "scoringSystem" = 'RoundWinner'`);
    }
}
