import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tournament } from '@persistence/entities';
import { LocalSeedService } from './local-seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tournament])],
  providers: [LocalSeedService],
})
export class LocalSeedModule {}
