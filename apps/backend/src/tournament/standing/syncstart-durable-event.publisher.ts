import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { SyncStartSongCompletedV1 } from '../../contracts/events';
import {
  DURABLE_EVENT_TRANSPORT,
  DurableEventTransport,
} from '../../eventing/eventing.interfaces';
import { ILobbyObserver, LobbySongCompletedDto } from '@syncstart/index';

@Injectable()
export class SyncStartDurableEventPublisher implements ILobbyObserver {
  constructor(
    private readonly config: ConfigService,
    @Inject(DURABLE_EVENT_TRANSPORT)
    private readonly transport: DurableEventTransport,
  ) {}

  async OnSongCompleted(event: LobbySongCompletedDto): Promise<void> {
    const id = randomUUID();
    const durableEvent: SyncStartSongCompletedV1 = {
      id,
      type: 'syncstart.song-completed',
      version: 1,
      aggregateId: String(event.tournamentId),
      occurredAt: new Date().toISOString(),
      correlationId: id,
      causationId: null,
      payload: event,
    };
    await this.transport.publish(this.stream, durableEvent);
  }

  private get stream(): string {
    return this.config.get('EVENT_STREAM') ?? 'tournament-manager.events';
  }
}
