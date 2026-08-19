import {
  Injectable,
  OnApplicationShutdown,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, RedisClientType } from "redis";
import type { SyncStartCommandResultPayload } from "@tournament-manager/contracts";

export type StoredLobbySession = {
  tournamentId: number;
  lobbyCode: string;
  lobbyName: string;
  password: string;
};

@Injectable()
export class SyncStartStateStore
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly client: RedisClientType;
  constructor(config: ConfigService) {
    this.client = createClient({
      url: `redis://${config.get("REDIS_HOST") ?? "127.0.0.1"}:${config.get("REDIS_PORT") ?? "6379"}`,
    });
  }
  async onModuleInit(): Promise<void> {
    await this.client.connect();
  }
  async onApplicationShutdown(): Promise<void> {
    await this.client.close();
  }

  async setConfiguration(tournamentId: number, url: string): Promise<void> {
    if (url)
      await this.client.hSet(
        "syncstart:configurations",
        String(tournamentId),
        url,
      );
    else
      await this.client.hDel("syncstart:configurations", String(tournamentId));
  }
  configurations(): Promise<Record<string, string>> {
    return this.client.hGetAll("syncstart:configurations");
  }
  async saveLobby(session: StoredLobbySession): Promise<void> {
    await this.client.hSet(
      "syncstart:lobbies",
      this.lobbyKey(session.tournamentId, session.lobbyCode),
      JSON.stringify(session),
    );
  }
  async deleteLobby(tournamentId: number, lobbyCode: string): Promise<void> {
    await this.client.hDel(
      "syncstart:lobbies",
      this.lobbyKey(tournamentId, lobbyCode),
    );
  }
  async deleteTournament(tournamentId: number): Promise<void> {
    await this.client.hDel("syncstart:configurations", String(tournamentId));
    const lobbies = await this.lobbies();
    const keys = lobbies
      .filter((lobby) => lobby.tournamentId === tournamentId)
      .map((lobby) => this.lobbyKey(tournamentId, lobby.lobbyCode));
    if (keys.length > 0) await this.client.hDel("syncstart:lobbies", keys);
  }
  async lobbies(): Promise<StoredLobbySession[]> {
    return Object.values(await this.client.hGetAll("syncstart:lobbies")).map(
      (value) => JSON.parse(value) as StoredLobbySession,
    );
  }
  async claimCommand(
    commandId: string,
  ): Promise<{ claimed: boolean; outcome?: SyncStartCommandResultPayload }> {
    const key = this.commandKey(commandId);
    const existing = await this.client.get(key);
    if (existing) {
      const record = JSON.parse(String(existing)) as {
        status: "started" | "completed";
        outcome?: SyncStartCommandResultPayload;
      };
      return { claimed: false, outcome: record.outcome };
    }
    const claimed = await this.client.set(
      key,
      JSON.stringify({ status: "started" }),
      { NX: true, EX: 7 * 24 * 60 * 60 },
    );
    if (claimed) return { claimed: true };
    return this.claimCommand(commandId);
  }
  async completeCommand(
    commandId: string,
    outcome: SyncStartCommandResultPayload,
  ): Promise<void> {
    await this.client.set(
      this.commandKey(commandId),
      JSON.stringify({ status: "completed", outcome }),
      { EX: 7 * 24 * 60 * 60 },
    );
  }
  private lobbyKey(tournamentId: number, code: string): string {
    return `${tournamentId}:${code.toUpperCase()}`;
  }
  private commandKey(commandId: string): string {
    return `syncstart:command:${commandId}`;
  }
}
