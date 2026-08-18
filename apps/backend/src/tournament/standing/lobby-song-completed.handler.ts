import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  EventEnvelope,
  isSyncStartSongCompletedV1,
} from '../../contracts/events';
import {
  DurableEventHandler,
  DurableEventHandlerRegistry,
} from '../../eventing/durable-event-handler.registry';
import { UiUpdateGateway } from '@match/gateways/ui-update.gateway';
import { ScoringSystemProvider } from '../services/scoring-systems/ScoringSystemProvider';
import { PostgresLobbySongCompletedPersistence } from './postgres-lobby-song-completed.persistence';

@Injectable()
export class LobbySongCompletedHandler
  implements DurableEventHandler, OnModuleInit
{
  readonly eventType = 'syncstart.song-completed';
  readonly version = 1;

  constructor(
    private readonly registry: DurableEventHandlerRegistry,
    private readonly persistence: PostgresLobbySongCompletedPersistence,
    private readonly scoringSystems: ScoringSystemProvider,
    private readonly uiUpdates: UiUpdateGateway,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async handle(event: EventEnvelope): Promise<boolean> {
    if (!isSyncStartSongCompletedV1(event)) {
      throw new Error(`Invalid ${this.eventType} v${this.version} event`);
    }
    const effect = await this.persistence.processOnce(
      event,
      (name, standings) => {
        const scoringSystem = this.scoringSystems.getScoringSystem(name);
        if (!scoringSystem) throw new Error(`Unknown scoring system ${name}`);
        scoringSystem.recalc(standings);
      },
    );
    if (!effect.processed) return false;
    for (const warning of effect.warnings) {
      this.uiUpdates.emitWarning(event.payload.tournamentId, warning);
    }
    for (const matchId of effect.matchIds) {
      await this.uiUpdates.emitMatchUpdateByMatchId(matchId);
    }
    return true;
  }
}
