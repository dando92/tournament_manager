import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ScoringSystemProvider } from '@tournament-manager/application';
import {
  EventEnvelope,
  LiveEventEnvelope,
  SyncStartSongCompletedEvent,
} from '@tournament-manager/contracts';
import { EntityManager } from 'typeorm';
import {
  EventConsumer,
  EventConsumerRegistry,
} from './eventing/event-consumer.registry';
import {
  LIVE_EVENT_TRANSPORT,
  LiveEventTransport,
} from '../../backend/src/eventing/eventing.interfaces';
import {
  LobbySongCompletedEffect,
  PostgresLobbySongCompletedPersistence,
} from '../../backend/src/tournament/standing/postgres-lobby-song-completed.persistence';

@Injectable()
export class LobbySongCompletedHandler implements EventConsumer, OnModuleInit {
  readonly identity = 'syncstart-song-completed';
  readonly eventType = 'syncstart.song-completed';

  constructor(
    private readonly registry: EventConsumerRegistry,
    private readonly persistence: PostgresLobbySongCompletedPersistence,
    private readonly scoringSystems: ScoringSystemProvider,
    private readonly config: ConfigService,
    @Inject(LIVE_EVENT_TRANSPORT)
    private readonly liveTransport: LiveEventTransport,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  handle(
    manager: EntityManager,
    event: EventEnvelope,
  ): Promise<LobbySongCompletedEffect> {
    return this.persistence.apply(
      manager,
      event as SyncStartSongCompletedEvent,
      (name, standings) => {
        const scoringSystem = this.scoringSystems.getScoringSystem(name);
        if (!scoringSystem) throw new Error(`Unknown scoring system ${name}`);
        scoringSystem.recalc(standings);
      },
    );
  }

  async afterCommit(event: EventEnvelope, result: unknown): Promise<void> {
    const completed = event as SyncStartSongCompletedEvent;
    const effect = result as LobbySongCompletedEffect;
    for (const warning of effect.warnings) {
      await this.publish(completed.payload.tournamentId, 'ui.warning', {
        message: warning,
      });
    }
    for (const matchId of effect.matchIds) {
      await this.publish(completed.payload.tournamentId, 'ui.match-changed', {
        matchId,
      });
    }
  }

  private publish(
    tournamentId: number,
    type: string,
    payload: unknown,
  ): Promise<void> {
    const event: LiveEventEnvelope = { type, tournamentId, payload };
    return this.liveTransport.publish(
      this.config.get('LIVE_EVENT_CHANNEL') ?? 'tournament-manager.live',
      event,
    );
  }
}
