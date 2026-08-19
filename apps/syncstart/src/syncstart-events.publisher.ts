import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  LiveEventEnvelope,
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
  LIVE_EVENT_TRANSPORT,
  LiveEventTransport,
} from "@tournament-manager/eventing";
import type { ILobbyObserver } from "./protocol";

@Injectable()
export class SyncStartEventsPublisher implements ILobbyObserver {
  constructor(
    private readonly config: ConfigService,
    @Inject(LIVE_EVENT_TRANSPORT) private readonly live: LiveEventTransport,
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
  async OnSongCompleted(event: LobbySongCompletedDto): Promise<void> {
    const response = await fetch(`${this.config.getOrThrow<string>('API_INTERNAL_URL')}/internal/syncstart/completed-songs`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-internal-service-token': this.config.getOrThrow<string>('INTERNAL_SERVICE_TOKEN') },
      body: JSON.stringify({ ...event, completionId: `${event.tournamentId}:${event.lobbyId}:${event.song.songPath}:${event.scores.map((score) => `${score.playerId}:${score.exScore}`).join(',')}` }),
    });
    if (!response.ok) throw new Error(`Completed-song submission failed with HTTP ${response.status}`);
    await this.publishLive(
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
    const event: LiveEventEnvelope = { type, tournamentId, payload };
    return this.live.publish(
      this.config.get("LIVE_EVENT_CHANNEL") ?? "tournament-manager.live",
      event,
    );
  }
}
