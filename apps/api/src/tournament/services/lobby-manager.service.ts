import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import type {
  LiveEventEnvelope,
  SyncStartCommandAction,
  SyncStartCommandEvent,
  SyncStartCommandPayload,
  SyncStartCommandResultPayload,
} from '@tournament-manager/contracts';
import {
  DURABLE_EVENT_TRANSPORT,
  DurableEventTransport,
  LIVE_EVENT_TRANSPORT,
  LiveEventTransport,
} from '@tournament-manager/eventing';
import { Tournament } from '@tournament-manager/persistence';

export type TournamentLobbyStatusDto = {
  id: string;
  name: string;
  lobbyCode: string;
  isPasswordProtected: boolean;
  playerCount: number;
  spectatorCount: number;
};
export type TournamentLobbiesDto = {
  status: { isActive: boolean; isConnected: boolean };
  lobbies: TournamentLobbyStatusDto[];
};

type PendingCommand = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

@Injectable()
export class LobbyManager implements OnModuleInit, OnModuleDestroy {
  private readonly pending = new Map<string, PendingCommand>();
  private unsubscribe?: () => Promise<void>;

  constructor(
    @InjectRepository(Tournament)
    private readonly tournaments: Repository<Tournament>,
    private readonly config: ConfigService,
    @Inject(DURABLE_EVENT_TRANSPORT)
    private readonly durable: DurableEventTransport,
    @Inject(LIVE_EVENT_TRANSPORT) private readonly live: LiveEventTransport,
  ) {}

  async onModuleInit(): Promise<void> {
    this.unsubscribe = await this.live.subscribe(this.liveChannel, (event) =>
      this.onLiveEvent(event),
    );
    for (const tournament of await this.tournaments.find()) {
      if (tournament.status !== 'closed' && tournament.syncstartUrl) {
        await this.sendNoWait('configure-tournament', tournament.id, {
          syncstartUrl: tournament.syncstartUrl,
        });
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.unsubscribe?.();
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('API is shutting down'));
    }
  }

  ConnectLobby(
    tournamentId: number,
    name: string,
    lobbyCode: string,
    password: string,
  ): Promise<string> {
    return this.send('connect-lobby', tournamentId, {
      lobbyName: name,
      lobbyCode,
      password,
    }).then((result) => (result as { id: string }).id);
  }
  CreateLobby(
    tournamentId: number,
    name: string,
    password: string,
  ): Promise<{ lobbyId: string; lobbyCode: string }> {
    return this.send('create-lobby', tournamentId, {
      lobbyName: name,
      password,
    }) as Promise<{ lobbyId: string; lobbyCode: string }>;
  }
  async DisconnectLobby(tournamentId: number, lobbyId: string): Promise<void> {
    await this.send('disconnect-lobby', tournamentId, { lobbyId });
  }
  OnTournamentCreated(
    tournamentId: number,
    syncstartUrl: string,
  ): Promise<void> {
    return this.sendNoWait('configure-tournament', tournamentId, {
      syncstartUrl,
    });
  }
  OnTournamentUrlChanged(
    tournamentId: number,
    syncstartUrl: string,
  ): Promise<void> {
    return this.sendNoWait('configure-tournament', tournamentId, {
      syncstartUrl,
    });
  }
  OnTournamentClosed(tournamentId: number): Promise<void> {
    return this.sendNoWait('close-tournament', tournamentId);
  }
  OnTournamentReopened(
    tournamentId: number,
    syncstartUrl: string,
  ): Promise<void> {
    return this.sendNoWait('configure-tournament', tournamentId, {
      syncstartUrl,
    });
  }
  GetLobbies(tournamentId: number): Promise<TournamentLobbiesDto> {
    return this.send(
      'list-lobbies',
      tournamentId,
    ) as Promise<TournamentLobbiesDto>;
  }
  ConnectSyncStartServer(
    tournamentId: number,
  ): Promise<{ isActive: boolean; isConnected: boolean }> {
    return this.send('connect-server', tournamentId) as Promise<{
      isActive: boolean;
      isConnected: boolean;
    }>;
  }
  DisconnectSyncStartServer(
    tournamentId: number,
  ): Promise<{ isActive: boolean; isConnected: boolean }> {
    return this.send('disconnect-server', tournamentId) as Promise<{
      isActive: boolean;
      isConnected: boolean;
    }>;
  }

  private send(
    action: SyncStartCommandAction,
    tournamentId: number,
    extra: Partial<SyncStartCommandPayload> = {},
  ): Promise<unknown> {
    const id = randomUUID();
    const event: SyncStartCommandEvent = {
      id,
      type: 'syncstart.command',
      aggregateId: String(tournamentId),
      payload: { action, tournamentId, ...extra },
    };
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => {
          this.pending.delete(id);
          reject(new Error(`SyncStart command timed out: ${action}`));
        },
        Number(this.config.get('SYNCSTART_COMMAND_TIMEOUT_MS') ?? 15000),
      );
      this.pending.set(id, { resolve, reject, timeout });
      this.durable.publish(this.commandStream, event).catch((error) => {
        clearTimeout(timeout);
        this.pending.delete(id);
        reject(error);
      });
    });
  }

  private async sendNoWait(
    action: SyncStartCommandAction,
    tournamentId: number,
    extra: Partial<SyncStartCommandPayload> = {},
  ): Promise<void> {
    const event: SyncStartCommandEvent = {
      id: randomUUID(),
      type: 'syncstart.command',
      aggregateId: String(tournamentId),
      payload: { action, tournamentId, ...extra },
    };
    await this.durable.publish(this.commandStream, event);
  }

  private onLiveEvent(event: LiveEventEnvelope): void {
    if (event.type === 'syncstart.command-result') {
      const result = event.payload as SyncStartCommandResultPayload;
      const pending = this.pending.get(result.commandId);
      if (!pending) return;
      clearTimeout(pending.timeout);
      this.pending.delete(result.commandId);
      if (result.ok) pending.resolve(result.result);
      else
        pending.reject(new Error(result.error ?? 'SyncStart command failed'));
      return;
    }
  }

  private get commandStream(): string {
    return (
      this.config.get('SYNCSTART_COMMAND_STREAM') ??
      'tournament-manager.syncstart.commands'
    );
  }
  private get liveChannel(): string {
    return this.config.get('LIVE_EVENT_CHANNEL') ?? 'tournament-manager.live';
  }
}
