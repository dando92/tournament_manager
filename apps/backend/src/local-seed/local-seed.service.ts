import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tournament } from '@persistence/entities';

@Injectable()
export class LocalSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(LocalSeedService.name);

  constructor(
    @InjectRepository(Tournament) private readonly tournaments: Repository<Tournament>,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.get('LOCAL_SEED_ENABLED') !== 'true') return;

    const name = this.config.get('LOCAL_SEED_TOURNAMENT_NAME') ?? 'Local E2E Tournament';
    const existing = await this.tournaments.findOneBy({ name });
    if (existing) {
      this.logger.log(`Local seed already exists (tournament ${existing.id}).`);
      return;
    }

    const tournament = this.tournaments.create({
      name,
      syncstartUrl: 'ws://syncstart-simulator:19000',
      availableSetupsCount: 2,
      defaultScoringSystem: 'EurocupScoreCalculator',
    });
    const saved = await this.tournaments.save(tournament);
    this.logger.log(`Created deterministic local seed (tournament ${saved.id}).`);
  }
}
