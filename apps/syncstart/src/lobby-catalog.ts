import { Injectable } from "@nestjs/common";
import type { LobbyConnectionDto } from "@tournament-manager/contracts";
import type {
  ILobbyObserver,
  SyncStartLobbySummaryDto,
} from "@tournament-manager/syncstart-protocol";

export type LobbySummary = {
  id: string;
  name: string;
  lobbyCode: string;
  isPasswordProtected: boolean;
  playerCount: number;
  spectatorCount: number;
};

@Injectable()
export class LobbyCatalog implements ILobbyObserver {
  private readonly lobbyMeta = new Map<string, LobbyConnectionDto>();

  OnConnectionActive(event: LobbyConnectionDto): void {
    this.remember(event);
  }

  OnConnected(event: LobbyConnectionDto): void {
    this.remember(event);
  }

  OnDisconnection(event: LobbyConnectionDto): void {
    if (!event.isActive) {
      this.lobbyMeta.delete(this.key(event.tournamentId, event.lobbyCode));
      return;
    }
    this.remember(event);
  }

  list(
    tournamentId: number,
    discovered: SyncStartLobbySummaryDto[],
  ): LobbySummary[] {
    const result = new Map<string, LobbySummary>();
    for (const lobby of discovered) {
      const lobbyCode = lobby.code.toUpperCase();
      const meta = this.lobbyMeta.get(this.key(tournamentId, lobbyCode));
      result.set(lobbyCode, {
        id: lobbyCode,
        name: meta?.lobbyName ?? lobbyCode,
        lobbyCode,
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
    return [...result.values()].sort((a, b) =>
      a.lobbyCode.localeCompare(b.lobbyCode),
    );
  }

  removeTournament(tournamentId: number): void {
    for (const [key, meta] of this.lobbyMeta) {
      if (meta.tournamentId === tournamentId) this.lobbyMeta.delete(key);
    }
  }

  private remember(event: LobbyConnectionDto): void {
    this.lobbyMeta.set(this.key(event.tournamentId, event.lobbyCode), event);
  }

  private key(tournamentId: number, lobbyCode: string): string {
    return `${tournamentId}:${lobbyCode.toUpperCase()}`;
  }
}
