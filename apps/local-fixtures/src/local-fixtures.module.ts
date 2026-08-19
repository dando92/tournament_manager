import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tournament } from '@tournament-manager/persistence';
import { LocalFixturesService } from './local-fixtures.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tournament])],
  providers: [LocalFixturesService],
  exports: [LocalFixturesService],
})
export class LocalFixturesModule {}
