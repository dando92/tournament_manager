import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntityManager } from 'typeorm';
import {
  EventEnvelope,
  LiveEventEnvelope,
  TournamentCreatedEvent,
  TournamentCreatedPayload,
} from '@tournament-manager/contracts';
import {
  EventConsumer,
  EventConsumerRegistry,
} from '@processor/eventing/event-consumer.registry';
import {
  LIVE_EVENT_TRANSPORT,
  LiveEventTransport,
} from '@tournament-manager/eventing';

@Injectable()
export class TournamentCreatedHandler implements EventConsumer, OnModuleInit {
  readonly identity = 'tournament-created-projection';
  readonly eventType = 'tournament.created';
  private readonly logger = new Logger(TournamentCreatedHandler.name);

  constructor(
    private readonly registry: EventConsumerRegistry,
    private readonly config: ConfigService,
    @Inject(LIVE_EVENT_TRANSPORT)
    private readonly liveTransport: LiveEventTransport,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  handle(manager: EntityManager, event: EventEnvelope): Promise<void> {
    return this.createTournamentProjection(
      manager,
      event as TournamentCreatedEvent,
    );
  }

  async afterCommit(event: EventEnvelope): Promise<void> {
    const payload = event.payload as TournamentCreatedPayload;
    const liveEvent: LiveEventEnvelope<TournamentCreatedPayload> = {
      type: 'tournament.snapshot-changed',
      tournamentId: payload.tournamentId,
      payload,
    };
    try {
      await this.liveTransport.publish(this.liveChannel, liveEvent);
    } catch (error) {
      this.logger.warn(
        `Replaceable live update was missed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private get liveChannel(): string {
    return this.config.get('LIVE_EVENT_CHANNEL') ?? 'tournament-manager.live';
  }

  private async createTournamentProjection(
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
