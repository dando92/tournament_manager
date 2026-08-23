import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A song carries the difficulty slot its chart was written for.
 *
 * The meter already said how hard the chart is; it never said which of the six
 * slots a pack author put it in, so the pool could not tell an Expert 13 from a
 * Hard 13 of the same song. The importer reads the slot out of the simfile
 * rather than deriving it from the meter, and the check constraint states the
 * six names the application knows. Songs added by hand state a meter alone and
 * keep a null slot, which is why the column is nullable.
 */
export class SongChartDifficulty1787800000000 implements MigrationInterface {
  name = 'SongChartDifficulty1787800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "song" ADD "chartDifficulty" character varying`);
    await queryRunner.query(
      `ALTER TABLE "song" ADD CONSTRAINT "CHK_song_chart_difficulty" CHECK ("chartDifficulty" IN ('Novice', 'Easy', 'Medium', 'Hard', 'Expert', 'Edit'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "song" DROP CONSTRAINT "CHK_song_chart_difficulty"`);
    await queryRunner.query(`ALTER TABLE "song" DROP COLUMN "chartDifficulty"`);
  }
}
