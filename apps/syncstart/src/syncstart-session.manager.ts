import { Injectable, OnApplicationShutdown } from "@nestjs/common";
import type {
  LobbyConnectionDto,
  SyncStartCommandPayload,
} from "@tournament-manager/contracts";
import { SyncStartConnector } from "./protocol";
import { SyncStartEventsPublisher } from "./syncstart-events.publisher";

type LobbyMeta = LobbyConnectionDto;
type LobbySummary = {
  id: string;
  name: string;
  lobbyCode: string;
  isPasswordProtected: boolean;
  playerCount: number;
  spectatorCount: number;
};

@Injectable()
export class SyncStartSessionManager implements OnApplicationShutdown {
  private readonly connectors = new Map<number, SyncStartConnector>();
  private readonly lobbyMeta = new Map<string, LobbyMeta>();

  constructor(private readonly events: SyncStartEventsPublisher) {}

  async execute(command: SyncStartCommandPayload): Promise<unknown> {
    switch (command.action) {
      case "configure-tournament":
        await this.configure(command.tournamentId, command.syncstartUrl ?? "");
        return { configured: Boolean(command.syncstartUrl) };
      case "close-tournament":
        await this.close(command.tournamentId);
        return { closed: true };
      case "connect-server":
        return this.connector(command.tournamentId).ConnectToServer(
          command.tournamentId,
        );
      case "disconnect-server":
        return this.connector(command.tournamentId).DisconnectFromServer();
      case "list-lobbies":
        return this.listLobbies(command.tournamentId);
      case "connect-lobby":
        return this.connectLobby(command);
      case "create-lobby":
        return this.createLobby(command);
      case "disconnect-lobby":
        await this.disconnectLobby(command.tournamentId, command.lobbyId ?? "");
        return { ok: true };
    }
  }

  onApplicationShutdown(): void {
    for (const connector of this.connectors.values()) connector.DisconnectAll();
  }

  OnConnectionActive(event: LobbyConnectionDto): void {
    this.remember(event);
  }
  OnConnected(event: LobbyConnectionDto): void {
    this.remember(event);
  }
  OnDisconnection(event: LobbyConnectionDto): void {
    if (!event.isActive)
      this.lobbyMeta.delete(this.key(event.tournamentId, event.lobbyCode));
    else this.remember(event);
  }

  private async configure(tournamentId: number, url: string): Promise<void> {
    await this.close(tournamentId);
    if (!url) return;
    this.createConnector(tournamentId, url);
  }

  private async close(tournamentId: number): Promise<void> {
    this.connectors.get(tournamentId)?.DisconnectAll();
    this.connectors.delete(tournamentId);
    for (const [key, meta] of this.lobbyMeta)
      if (meta.tournamentId === tournamentId) this.lobbyMeta.delete(key);
  }

  private async connectLobby(
    command: SyncStartCommandPayload,
  ): Promise<{ id: string }> {
    const code = (command.lobbyCode ?? "").toUpperCase();
    const result = await this.connector(command.tournamentId).SpectateLobby({
      tournamentId: command.tournamentId,
      lobbyName: command.lobbyName || code,
      lobbyCode: code,
      password: command.password ?? "",
    });
    return { id: result.lobbyId };
  }

  private async createLobby(
    command: SyncStartCommandPayload,
  ): Promise<{ lobbyId: string; lobbyCode: string }> {
    const result = await this.connector(command.tournamentId).CreateLobby({
      tournamentId: command.tournamentId,
      lobbyName: command.lobbyName || undefined,
      password: command.password ?? "",
    });
    return result;
  }

  private async disconnectLobby(
    tournamentId: number,
    lobbyId: string,
  ): Promise<void> {
    const code = lobbyId.toUpperCase();
    this.connectors.get(tournamentId)?.LeaveLobby(code);
    this.lobbyMeta.delete(this.key(tournamentId, code));
  }

  private async listLobbies(tournamentId: number): Promise<{
    status: { isActive: boolean; isConnected: boolean };
    lobbies: LobbySummary[];
  }> {
    const connector = this.connectors.get(tournamentId);
    const status = {
      isActive: connector?.IsActive() ?? false,
      isConnected: connector?.IsConnected() ?? false,
    };
    const discovered =
      connector && status.isConnected ? await connector.SearchLobbies() : [];
    const result = new Map<string, LobbySummary>();
    for (const lobby of discovered) {
      const code = lobby.code.toUpperCase();
      const meta = this.lobbyMeta.get(this.key(tournamentId, code));
      result.set(code, {
        id: code,
        name: meta?.lobbyName ?? code,
        lobbyCode: code,
        isPasswordProtected: lobby.isPasswordProtected,
        playerCount: lobby.playerCount,
        spectatorCount: lobby.spectatorCount,
      });
    }
    for (const meta of this.lobbyMeta.values()) {
      if (meta.tournamentId !== tournamentId) continue;
      const existing = result.get(meta.lobbyCode);
      result.set(meta.lobbyCode, {
        id: meta.lobbyId,
        name: meta.lobbyName,
        lobbyCode: meta.lobbyCode,
        isPasswordProtected: existing?.isPasswordProtected ?? false,
        playerCount: existing?.playerCount ?? 0,
        spectatorCount: existing?.spectatorCount ?? 0,
      });
    }
    return {
      status,
      lobbies: [...result.values()].sort((a, b) =>
        a.lobbyCode.localeCompare(b.lobbyCode),
      ),
    };
  }

  private connector(tournamentId: number): SyncStartConnector {
    const connector = this.connectors.get(tournamentId);
    if (!connector)
      throw new Error(
        `No SyncStart connector for tournament=${tournamentId}. Ensure the tournament has a syncstartUrl set.`,
      );
    return connector;
  }
  private createConnector(tournamentId: number, url: string): void {
    this.connectors.set(
      tournamentId,
      new SyncStartConnector(url, [this, this.events]),
    );
  }
  private remember(event: LobbyConnectionDto): void {
    this.lobbyMeta.set(this.key(event.tournamentId, event.lobbyCode), event);
  }
  private key(tournamentId: number, code: string): string {
    return `${tournamentId}:${code.toUpperCase()}`;
  }
}
