import { Injectable, OnModuleInit } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  EventEnvelope,
  SyncStartSongCompletedEvent,
} from '../../contracts/events';
import {
  EventConsumer,
  EventConsumerRegistry,
} from '../../eventing/event-consumer.registry';
import { UiUpdateGateway } from '@match/gateways/ui-update.gateway';
import { ScoringSystemProvider } from '../services/scoring-systems/ScoringSystemProvider';
import {
  LobbySongCompletedEffect,
  PostgresLobbySongCompletedPersistence,
} from './postgres-lobby-song-completed.persistence';

@Injectable()
export class LobbySongCompletedHandler
  implements EventConsumer, OnModuleInit
{
  readonly identity = 'syncstart-song-completed';
  readonly eventType = 'syncstart.song-completed';

  constructor(
    private readonly registry: EventConsumerRegistry,
    private readonly persistence: PostgresLobbySongCompletedPersistence,
    private readonly scoringSystems: ScoringSystemProvider,
    private readonly uiUpdates: UiUpdateGateway,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  handle(
    manager: EntityManager,
    event: EventEnvelope,
  ): Promise<LobbySongCompletedEffect> {
    const completedEvent = event as SyncStartSongCompletedEvent;
    return this.persistence.apply(
      manager,
      completedEvent,
      (name, standings) => {
        const scoringSystem = this.scoringSystems.getScoringSystem(name);
        if (!scoringSystem) throw new Error(`Unknown scoring system ${name}`);
        scoringSystem.recalc(standings);
      },
    );
  }

  async afterCommit(event: EventEnvelope, result: unknown): Promise<void> {
    const completedEvent = event as SyncStartSongCompletedEvent;
    const effect = result as LobbySongCompletedEffect;
    for (const warning of effect.warnings) {
      this.uiUpdates.emitWarning(completedEvent.payload.tournamentId, warning);
    }
    for (const matchId of effect.matchIds) {
      await this.uiUpdates.emitMatchUpdateByMatchId(matchId);
    }
  }
}
