import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tournament } from '@tournament-manager/persistence';

@Injectable()
export class LocalFixturesService {
  private readonly logger = new Logger(LocalFixturesService.name);

  constructor(
    @InjectRepository(Tournament)
    private readonly tournaments: Repository<Tournament>,
    private readonly config: ConfigService,
  ) {}

  async apply(): Promise<void> {
    const name =
      this.config.get('LOCAL_FIXTURE_TOURNAMENT_NAME') ?? 'Local E2E Tournament';
    const existing = await this.tournaments.findOneBy({ name });
    if (existing) {
      this.logger.log(`Local seed already exists (tournament ${existing.id}).`);
      await this.configureSyncStart(existing);
      return;
    }

    const tournament = this.tournaments.create({
      name,
      syncstartUrl: this.config.get('LOCAL_FIXTURE_SYNCSTART_URL'),
      availableSetupsCount: 2,
      defaultScoringSystem: 'EurocupScoreCalculator',
    });
    const saved = await this.tournaments.save(tournament);
    await this.configureSyncStart(saved);
    this.logger.log(
      `Created deterministic local seed (tournament ${saved.id}).`,
    );
  }

  private async configureSyncStart(tournament: Tournament): Promise<void> {
    if (!tournament.syncstartUrl) return;
    const response = await fetch(`${this.config.getOrThrow<string>('SYNCSTART_INTERNAL_URL')}/internal/tournaments/${tournament.id}/configuration`, {
      method: 'PUT', headers: { 'content-type': 'application/json', 'x-internal-service-token': this.config.getOrThrow<string>('INTERNAL_SERVICE_TOKEN') },
      body: JSON.stringify({ syncstartUrl: tournament.syncstartUrl }),
    });
    if (!response.ok) throw new Error(`SyncStart configuration failed with HTTP ${response.status}`);
  }
}
