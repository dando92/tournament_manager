import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tournament } from '@tournament-manager/persistence';
import { LocalSeedService } from './local-seed.service';
import { EventingModule } from '../eventing/eventing.module';

@Module({
  imports: [TypeOrmModule.forFeature([Tournament]), EventingModule],
  providers: [LocalSeedService],
})
export class LocalSeedModule {}
