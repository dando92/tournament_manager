import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Tournament } from '@tournament-manager/persistence';
import { Repository } from 'typeorm';
import { TournamentSyncStartService } from './tournament-syncstart.service';

/** Reconciles persisted tournament configuration with SyncStart when the API starts. */
@Injectable()
export class TournamentSyncStartBootstrap implements OnModuleInit {
  constructor(
    @InjectRepository(Tournament)
    private readonly tournaments: Repository<Tournament>,
    private readonly syncStart: TournamentSyncStartService,
  ) {}

  async onModuleInit(): Promise<void> {
    for (const tournament of await this.tournaments.find()) {
      if (tournament.status !== 'closed' && tournament.syncstartUrl) {
        await this.syncStart.configureTournament(
          tournament.id,
          tournament.syncstartUrl,
        );
      }
    }
  }
}
