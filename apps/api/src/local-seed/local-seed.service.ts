import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tournament } from '@tournament-manager/persistence';
import { Inject } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SyncStartCommandEvent } from '@tournament-manager/contracts';
import {
  DURABLE_EVENT_TRANSPORT,
  DurableEventTransport,
} from '@tournament-manager/eventing';

@Injectable()
export class LocalSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(LocalSeedService.name);

  constructor(
    @InjectRepository(Tournament)
    private readonly tournaments: Repository<Tournament>,
    private readonly config: ConfigService,
    @Inject(DURABLE_EVENT_TRANSPORT)
    private readonly eventTransport: DurableEventTransport,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.get('LOCAL_SEED_ENABLED') !== 'true') return;

    const name =
      this.config.get('LOCAL_SEED_TOURNAMENT_NAME') ?? 'Local E2E Tournament';
    const existing = await this.tournaments.findOneBy({ name });
    if (existing) {
      this.logger.log(`Local seed already exists (tournament ${existing.id}).`);
      await this.configureSyncStart(existing);
      return;
    }

    const tournament = this.tournaments.create({
      name,
      syncstartUrl: 'ws://syncstart-simulator:19000',
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
    const event: SyncStartCommandEvent = {
      id: randomUUID(),
      type: 'syncstart.command',
      aggregateId: String(tournament.id),
      payload: {
        action: 'configure-tournament',
        tournamentId: tournament.id,
        syncstartUrl: tournament.syncstartUrl,
      },
    };
    await this.eventTransport.publish(
      this.config.get('SYNCSTART_COMMAND_STREAM') ??
        'tournament-manager.syncstart.commands',
      event,
    );
  }
}
