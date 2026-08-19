import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import type {
  LiveEventEnvelope,
  LobbyConnectionDto,
  LobbyMatchUpdateDto,
  LobbyPlayerReadyDto,
  LobbySongCompletedDto,
  LobbySongSelectedDto,
  SyncStartCommandResultPayload,
  SyncStartConnectionStatusDto,
  SyncStartSongCompletedEvent,
  SyncStartTelemetryType,
} from "@tournament-manager/contracts";
import {
  DURABLE_EVENT_TRANSPORT,
  DurableEventTransport,
  LIVE_EVENT_TRANSPORT,
  LiveEventTransport,
} from "@tournament-manager/eventing";
import type { ILobbyObserver } from "./protocol";

@Injectable()
export class SyncStartEventsPublisher implements ILobbyObserver {
  constructor(
    private readonly config: ConfigService,
    @Inject(DURABLE_EVENT_TRANSPORT)
    private readonly durable: DurableEventTransport,
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
    const durableEvent: SyncStartSongCompletedEvent = {
      id: randomUUID(),
      type: "syncstart.song-completed",
      aggregateId: String(event.tournamentId),
      payload: event,
    };
    await this.durable.publish(
      this.config.get("EVENT_STREAM") ?? "tournament-manager.events",
      durableEvent,
    );
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
