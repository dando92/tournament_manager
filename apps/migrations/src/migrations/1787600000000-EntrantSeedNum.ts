import { MigrationInterface, QueryRunner } from 'typeorm';

export class EntrantSeedNum1787600000000 implements MigrationInterface {
  name = 'EntrantSeedNum1787600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "entrant" ADD "seedNum" integer`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "entrant" DROP COLUMN "seedNum"`);
  }
}
