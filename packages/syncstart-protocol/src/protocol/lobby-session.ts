import { LobbyConnection } from "./lobby-connection";
import { LobbyStateInterpreter } from "./lobby-state-interpreter";
import type { LobbyConnectionResultDto } from "./syncstart-connector.types";

export type LobbySessionMode = { type: "create" } | { type: "spectate"; lobbyCode: string };

export type PendingLobbyConnection = {
  resolve: (result: LobbyConnectionResultDto) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

/** Volatile state and transport for exactly one SyncStart lobby. */
export class LobbySession {
  currentLobbyCode: string | null;
  pendingConnect: PendingLobbyConnection | null = null;
  currentSocketConnectedNotified = false;
  readonly stateInterpreter = new LobbyStateInterpreter();

  constructor(
    readonly mode: LobbySessionMode,
    readonly connection: LobbyConnection,
    readonly tournamentId: number,
    readonly lobbyName: string | undefined,
    readonly password: string,
  ) {
    this.currentLobbyCode = mode.type === "spectate" ? mode.lobbyCode : null;
  }
}
