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

/** Owns the replaceable lobby query projection for one tournament runtime. */
export class LobbyCatalog implements ILobbyObserver {
  private readonly lobbyMeta = new Map<string, LobbyConnectionDto>();

  constructor(readonly tournamentId: number) {}

  OnConnectionActive(event: LobbyConnectionDto): void {
    this.remember(event);
  }

  OnConnected(event: LobbyConnectionDto): void {
    this.remember(event);
  }

  OnDisconnection(event: LobbyConnectionDto): void {
    this.assertOwner(event);
    const lobbyCode = event.lobbyCode.toUpperCase();
    if (!event.isActive) {
      this.lobbyMeta.delete(lobbyCode);
      return;
    }
    this.lobbyMeta.set(lobbyCode, event);
  }

  list(discovered: SyncStartLobbySummaryDto[]): LobbySummary[] {
    const result = new Map<string, LobbySummary>();
    for (const lobby of discovered) {
      const lobbyCode = lobby.code.toUpperCase();
      const meta = this.lobbyMeta.get(lobbyCode);
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

  clear(): void {
    this.lobbyMeta.clear();
  }

  private remember(event: LobbyConnectionDto): void {
    this.assertOwner(event);
    this.lobbyMeta.set(event.lobbyCode.toUpperCase(), event);
  }

  private assertOwner(event: LobbyConnectionDto): void {
    if (event.tournamentId !== this.tournamentId) {
      throw new Error(
        `Cannot apply tournament ${event.tournamentId} lobby event to tournament ${this.tournamentId} catalog`,
      );
    }
  }
}
