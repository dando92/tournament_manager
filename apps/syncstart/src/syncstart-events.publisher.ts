import { Inject, Injectable } from "@nestjs/common";
import type {
  LobbyConnectionDto,
  LobbyMatchUpdateDto,
  LobbyPlayerReadyDto,
  LobbySongCompletedDto,
  LobbySongSelectedDto,
  SyncStartCommandResultPayload,
  SyncStartConnectionStatusDto,
  SyncStartTelemetryType,
} from "@tournament-manager/contracts";
import {
  LIVE_EVENT_PUBLISHER,
  type EventEnvelope,
  LiveEventPublisher,
} from "@tournament-manager/live-messaging";
import type { ILobbyObserver } from "@tournament-manager/syncstart-protocol";

@Injectable()
export class SyncStartEventsPublisher implements ILobbyObserver {
  constructor(
    @Inject(LIVE_EVENT_PUBLISHER) private readonly live: LiveEventPublisher,
  ) {}

  publishCommandResult(
    tournamentId: number,
    result: SyncStartCommandResultPayload,
  ): Promise<void> {
    return this.publishLive("syncstart.command-result", tournamentId, result);
  }

  OnSyncStartConnectionStatus(
    event: SyncStartConnectionStatusDto,
  ): Promise<void> {
    return this.publishLive(
      "syncstart.connection-status",
      event.tournamentId,
      event,
    );
  }
  OnConnectionActive(event: LobbyConnectionDto): Promise<void> {
    return this.publishLive(
      "syncstart.lobby-active",
      event.tournamentId,
      event,
    );
  }
  OnConnected(event: LobbyConnectionDto): Promise<void> {
    return this.publishLive(
      "syncstart.lobby-connected",
      event.tournamentId,
      event,
    );
  }
  OnDisconnection(event: LobbyConnectionDto): Promise<void> {
    return this.publishLive(
      "syncstart.lobby-disconnected",
      event.tournamentId,
      event,
    );
  }
  OnSongSelected(event: LobbySongSelectedDto): Promise<void> {
    return this.publishLive(
      "syncstart.song-selected",
      event.tournamentId,
      event,
    );
  }
  OnGoingMatchUpdate(event: LobbyMatchUpdateDto): Promise<void> {
    return this.publishLive(
      "syncstart.match-update",
      event.tournamentId,
      event,
    );
  }
  OnPlayerReady(event: LobbyPlayerReadyDto): Promise<void> {
    return this.publishLive(
      "syncstart.player-ready",
      event.tournamentId,
      event,
    );
  }
  OnSongCompleted(event: LobbySongCompletedDto): Promise<void> {
    return this.publishLive(
      "syncstart.song-completed-live",
      event.tournamentId,
      event,
    );
  }

  private publishLive(
    type: SyncStartTelemetryType,
    tournamentId: number,
    payload: unknown,
  ): Promise<void> {
    const event: EventEnvelope = { type, tournamentId, payload };
    return this.live.publish(event);
  }
}
