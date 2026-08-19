import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Tournament } from '@persistence/entities';
import { NewEvent, OutboxService } from '@tournament-manager/eventing';

@Injectable()
export class PostgresTournamentPersistence {
  constructor(
    private readonly dataSource: DataSource,
    private readonly outbox: OutboxService,
  ) {}

  createWithEvent(
    tournament: Tournament,
    eventFor: (saved: Tournament) => NewEvent<unknown>,
  ): Promise<Tournament> {
    return this.dataSource.transaction(async (manager) => {
      const saved = await manager.getRepository(Tournament).save(tournament);
      await this.outbox.add(manager, eventFor(saved));
      return saved;
    });
  }
}
