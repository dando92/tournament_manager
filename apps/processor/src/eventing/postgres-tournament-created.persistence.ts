import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { TournamentCreatedEvent } from '@tournament-manager/contracts';

@Injectable()
export class PostgresTournamentCreatedPersistence {
  async apply(
    manager: EntityManager,
    event: TournamentCreatedEvent,
  ): Promise<void> {
    await manager.query(
      `INSERT INTO tournament_event_projection
          (tournament_id, created_event_id, name)
         VALUES ($1, $2, $3)
         ON CONFLICT (tournament_id) DO NOTHING`,
      [event.payload.tournamentId, event.id, event.payload.name],
    );
  }
}
