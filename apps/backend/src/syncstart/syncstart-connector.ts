import {
  ILobbyObserver,
  LobbyCompletedScoreDto,
  LobbyIdentityDto,
  LobbyJudgmentsDto,
  LobbyLivePlayerDto,
  LobbySongDto,
} from './lobby-observer.interface';
import { LobbyEventDispatcher } from './lobby-event.dispatcher';
import { LobbyConnection, LobbyConnectionCloseEvent } from './lobby-connection';
import {
  CreateLobbyRequestDto,
  LobbyConnectionResultDto,
  SpectateLobbyRequestDto,
  SyncStartLobbySummaryDto,
} from './syncstart-connector.types';
import {
  SyncStartLobbyPlayer,
  SyncStartLobbyStatePayload,
} from './syncstart-protocol.types';

type SyncStartMessage<T = unknown> = {
  event: string;
  data?: T;
};

type SearchLobbyResponse = {
  lobbies?: SyncStartLobbySummaryDto[];
};

type LobbySessionMode =
  | { type: 'create' }
  | { type: 'spectate'; lobbyCode: string };

type PendingLobbyConnection = {
  resolve: (result: LobbyConnectionResultDto) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

type PendingLobbySearch = {
  resolve: (lobbies: SyncStartLobbySummaryDto[]) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

type LobbySession = {
  mode: LobbySessionMode;
  connection: LobbyConnection;
  tournamentId: number;
  lobbyName?: string;
  password: string;
  currentLobbyCode: string | null;
  pendingConnect: PendingLobbyConnection | null;
  currentSocketConnectedNotified: boolean;
  previousSongKey: string | null;
  readyByPlayerKey: Map<string, boolean>;
  screenByPlayerKey: Map<string, SyncStartLobbyPlayer['screenName']>;
  lastCompletedSignature: string | null;
};

export class SyncStartConnector {
  private readonly dispatcher: LobbyEventDispatcher;
  private serverConnection: LobbyConnection | null = null;
  private serverTournamentId: number | null = null;
  private pendingLobbySearch: PendingLobbySearch | null = null;
  private connections = new Map<string, LobbySession>();

  constructor(
    private readonly syncstartUrl: string,
    observers: ILobbyObserver[],
  ) {
    this.dispatcher = new LobbyEventDispatcher(observers);
  }

  async CreateLobby(request: CreateLobbyRequestDto): Promise<LobbyConnectionResultDto> {
    const session = this.createLobbySession(
      { type: 'create' },
      request.tournamentId,
      request.lobbyName,
      request.password ?? '',
    );
    const result = await this.connectLobbySession(session);
    this.connections.set(result.lobbyCode, session);
    return result;
  }

  async SpectateLobby(request: SpectateLobbyRequestDto): Promise<LobbyConnectionResultDto> {
    const normalizedLobbyCode = request.lobbyCode.toUpperCase();
    if (this.connections.has(normalizedLobbyCode)) {
      throw new Error(`Lobby ${normalizedLobbyCode} is already connected`);
    }

    const session = this.createLobbySession(
      { type: 'spectate', lobbyCode: normalizedLobbyCode },
      request.tournamentId,
      request.lobbyName,
      request.password ?? '',
    );
    this.connections.set(normalizedLobbyCode, session);

    try {
      const result = await this.connectLobbySession(session);
      if (result.lobbyCode !== normalizedLobbyCode) {
        this.connections.delete(normalizedLobbyCode);
        this.connections.set(result.lobbyCode, session);
      }
      return result;
    } catch (error) {
      this.connections.delete(normalizedLobbyCode);
      throw error;
    }
  }

  async ChangeSong(): Promise<void> {
    throw new Error('ChangeSong is not implemented');
  }

  async ConnectToServer(tournamentId: number): Promise<{ isActive: boolean; isConnected: boolean }> {
    this.serverTournamentId = tournamentId;
    if (!this.serverConnection) {
      this.serverConnection = new LobbyConnection(this.syncstartUrl, {
        label: `server tournament=${tournamentId}`,
        onOpen: () => this.dispatchServerStatus(),
        onMessage: (message) => this.handleServerMessage(message),
        onClose: () => {
          this.rejectPendingLobbySearch(new Error('SyncStart server connection closed'));
          return this.dispatchServerStatus();
        },
        onError: (error) => {
          this.rejectPendingLobbySearch(error);
        },
      });
    }

    if (this.serverConnection.IsConnected()) return this.serverStatus();

    const connectPromise = this.serverConnection.Connect();
    await this.dispatchServerStatus();
    try {
      await connectPromise;
    } catch (error) {
      await this.dispatchServerStatus();
      throw error;
    }
    return this.serverStatus();
  }

  DisconnectFromServer(): { isActive: boolean; isConnected: boolean } {
    this.rejectPendingLobbySearch(new Error('SyncStart server disconnected'));
    this.serverConnection?.Disconnect();
    this.serverConnection = null;
    return this.serverStatus();
  }

  SearchLobbies(): Promise<SyncStartLobbySummaryDto[]> {
    if (!this.serverConnection?.IsConnected()) {
      return Promise.reject(new Error('SyncStart server is not connected'));
    }

    if (this.pendingLobbySearch) {
      return Promise.reject(new Error('Lobby search is already in progress'));
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingLobbySearch = null;
        reject(new Error('Lobby search timeout'));
      }, 10000);

      this.pendingLobbySearch = { resolve, reject, timeout };
      try {
        this.serverConnection?.Send(
          JSON.stringify({
            event: 'searchLobby',
            data: { temporary: false },
          }),
        );
      } catch (error) {
        this.pendingLobbySearch = null;
        clearTimeout(timeout);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  IsActive(): boolean {
    return this.serverConnection?.IsActive() ?? false;
  }

  IsConnected(): boolean {
    return this.serverConnection?.IsConnected() ?? false;
  }

  LeaveLobby(lobbyCode: string): void {
    const normalizedLobbyCode = lobbyCode.toUpperCase();
    const session = this.connections.get(normalizedLobbyCode);
    if (!session) return;
    session.connection.Disconnect();
    this.connections.delete(normalizedLobbyCode);
  }

  DisconnectAll(): void {
    this.DisconnectFromServer();

    for (const [lobbyCode, session] of this.connections) {
      session.connection.Disconnect();
      this.connections.delete(lobbyCode);
    }
  }

  private createLobbySession(
    mode: LobbySessionMode,
    tournamentId: number,
    lobbyName: string | undefined,
    password: string,
  ): LobbySession {
    let session: LobbySession;
    const connection = new LobbyConnection(this.syncstartUrl, {
      label: `lobby mode=${mode.type}`,
      autoReconnect: mode.type === 'spectate',
      onOpen: async () => {
        session.currentSocketConnectedNotified = false;
        await this.onLobbySocketOpen(session);
      },
      onMessage: (message) => this.handleLobbyMessage(session, message),
      onClose: (event) => this.handleLobbyClose(session, event),
      onError: (error) => {
        this.rejectPendingLobbyConnect(session, error);
      },
    });

    session = {
      mode,
      connection,
      tournamentId,
      lobbyName,
      password,
      currentLobbyCode: mode.type === 'spectate' ? mode.lobbyCode : null,
      pendingConnect: null,
      currentSocketConnectedNotified: false,
      previousSongKey: null,
      readyByPlayerKey: new Map<string, boolean>(),
      screenByPlayerKey: new Map<string, SyncStartLobbyPlayer['screenName']>(),
      lastCompletedSignature: null,
    };
    return session;
  }

  private async connectLobbySession(session: LobbySession): Promise<LobbyConnectionResultDto> {
    const pendingResult = this.waitForInitialLobbyState(session);
    const connectPromise = session.connection.Connect();
    await this.dispatchLobbyActive(session);

    try {
      await connectPromise;
      return await pendingResult;
    } catch (error) {
      this.rejectPendingLobbyConnect(
        session,
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  private async dispatchLobbyActive(session: LobbySession): Promise<void> {
    const identity = this.currentIdentity(session);
    if (!identity) return;
    await this.dispatcher.OnConnectionActive({
      ...identity,
      isActive: session.connection.IsActive(),
      isConnected: session.connection.IsConnected(),
    });
  }

  private waitForInitialLobbyState(session: LobbySession): Promise<LobbyConnectionResultDto> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        session.pendingConnect = null;
        session.connection.Disconnect();
        reject(new Error('SyncStart lobby state timeout'));
      }, 10000);

      session.pendingConnect = { resolve, reject, timeout };
    });
  }

  private async onLobbySocketOpen(session: LobbySession): Promise<void> {
    if (session.mode.type === 'create') {
      session.connection.Send(
        JSON.stringify({
          event: 'createLobby',
          data: {
            machine: {},
            password: session.password,
          },
        }),
      );
      return;
    }

    await this.notifyConnected(session, session.mode.lobbyCode);
    session.connection.Send(
      JSON.stringify({
        event: 'spectateLobby',
        data: {
          code: session.mode.lobbyCode,
          password: session.password,
          spectator: { profileName: 'TournamentManager' },
        },
      }),
    );
  }

  private async handleLobbyMessage(session: LobbySession, message: string): Promise<void> {
    const payload = this.parseMessage(message);
    if (!payload) return;

    if (payload.event === 'lobbyState') {
      await this.handleLobbyState(session, payload.data as SyncStartLobbyStatePayload);
      return;
    }

    if (payload.event === 'clientDisconnected' && session.connection.IsActive()) {
      const reason = (payload.data as { reason?: string })?.reason ?? '(no reason)';
      console.warn(
        `[SyncStartConnector] clientDisconnected, reason="${reason}" (lobbyCode=${session.currentLobbyCode ?? 'unknown'})`,
      );
      session.connection.Disconnect();
    }
  }

  private async handleLobbyState(
    session: LobbySession,
    lobbyState: SyncStartLobbyStatePayload,
  ): Promise<void> {
    const lobbyCode = lobbyState.code.toUpperCase();
    const previousLobbyCode = session.currentLobbyCode;
    session.currentLobbyCode = lobbyCode;

    if (previousLobbyCode && previousLobbyCode !== lobbyCode) {
      this.connections.delete(previousLobbyCode);
      this.connections.set(lobbyCode, session);
    }

    if (session.pendingConnect) {
      const pending = session.pendingConnect;
      session.pendingConnect = null;
      clearTimeout(pending.timeout);
      await this.notifyConnected(session, lobbyCode);
      await this.dispatchLobbyState(session, lobbyState);
      pending.resolve({ lobbyId: lobbyCode, lobbyCode });
      return;
    }

    await this.dispatchLobbyState(session, lobbyState);
  }

  private async handleLobbyClose(
    session: LobbySession,
    event: LobbyConnectionCloseEvent,
  ): Promise<void> {
    const lobbyCode = session.currentLobbyCode;
    this.rejectPendingLobbyConnect(
      session,
      new Error(`Connection closed, code=${event.code ?? 'unknown'} reason=${event.reason ?? '(no reason)'}`),
    );

    if (!lobbyCode) return;

    await this.dispatcher.OnDisconnection({
      ...this.identity(session, lobbyCode),
      isActive: event.isActive,
      isConnected: event.isConnected,
    });

    if (!event.isActive) {
      this.connections.delete(lobbyCode);
    }
  }

  private async handleServerMessage(message: string): Promise<void> {
    const response = this.parseMessage<SearchLobbyResponse>(message);
    if (!response || response.event !== 'lobbySearched' || !this.pendingLobbySearch) return;

    const pending = this.pendingLobbySearch;
    this.pendingLobbySearch = null;
    clearTimeout(pending.timeout);
    pending.resolve(response.data?.lobbies ?? []);
  }

  private parseMessage<T = unknown>(message: string): SyncStartMessage<T> | null {
    try {
      return JSON.parse(message) as SyncStartMessage<T>;
    } catch {
      console.warn(`[SyncStartConnector] Unparseable message: ${message.slice(0, 200)}`);
      return null;
    }
  }

  private async dispatchServerStatus(): Promise<void> {
    if (this.serverTournamentId === null) return;
    await this.dispatcher.OnSyncStartConnectionStatus({
      tournamentId: this.serverTournamentId,
      ...this.serverStatus(),
    });
  }

  private serverStatus(): { isActive: boolean; isConnected: boolean } {
    return {
      isActive: this.IsActive(),
      isConnected: this.IsConnected(),
    };
  }

  private rejectPendingLobbySearch(error: Error): void {
    if (!this.pendingLobbySearch) return;
    const pending = this.pendingLobbySearch;
    this.pendingLobbySearch = null;
    clearTimeout(pending.timeout);
    pending.reject(error);
  }

  private rejectPendingLobbyConnect(session: LobbySession, error: Error): void {
    if (!session.pendingConnect) return;
    const pending = session.pendingConnect;
    session.pendingConnect = null;
    clearTimeout(pending.timeout);
    pending.reject(error);
  }

  private async dispatchLobbyState(
    session: LobbySession,
    lobbyState: SyncStartLobbyStatePayload,
  ): Promise<void> {
    const lobbyCode = lobbyState.code.toUpperCase();
    const identity = this.identity(session, lobbyCode);
    const song = this.toSongDto(lobbyState);
    const playerTransitions = lobbyState.players.map((player) => {
      const playerKey = this.playerStateKey(player);
      return {
        player,
        playerKey,
        previousScreen: session.screenByPlayerKey.get(playerKey),
      };
    });

    if (song) {
      const songKey = `${song.songPath}|${song.title}`;
      if (songKey !== session.previousSongKey) {
        session.previousSongKey = songKey;
        session.lastCompletedSignature = null;
        await this.dispatcher.OnSongSelected({ ...identity, song });
      }
    }

    for (const { player, playerKey } of playerTransitions) {
      const knownPlayer =
        session.readyByPlayerKey.has(playerKey) || session.screenByPlayerKey.has(playerKey);
      if (knownPlayer) {
        continue;
      }

      session.readyByPlayerKey.set(playerKey, false);
      await this.dispatcher.OnPlayerReady({
        ...identity,
        playerId: player.playerId,
        playerName: this.normalizePlayerName(player.profileName),
        ready: false,
      });
    }

    const gameplayPlayers = lobbyState.players.filter(
      (player) => player.screenName === 'ScreenGameplay',
    );
    for (const player of gameplayPlayers) {
      const playerKey = this.playerStateKey(player);
      const previousReady = session.readyByPlayerKey.get(playerKey);
      if (previousReady !== player.ready) {
        session.readyByPlayerKey.set(playerKey, player.ready);
        await this.dispatcher.OnPlayerReady({
          ...identity,
          playerId: player.playerId,
          playerName: this.normalizePlayerName(player.profileName),
          ready: player.ready,
        });
      }
    }

    if (gameplayPlayers.length > 0) {
      await this.dispatcher.OnGoingMatchUpdate({
        ...identity,
        song,
        players: gameplayPlayers.map((player) => this.toLivePlayerDto(player)),
      });
    }

    const playerMovedToEvaluation = playerTransitions.some(
      ({ player, previousScreen }) =>
        previousScreen === 'ScreenGameplay' && this.isEvaluationScreen(player.screenName),
    );
    if (song && playerMovedToEvaluation) {
      const scores = lobbyState.players.map((player) => this.toCompletedScoreDto(player));
      const signature = this.completedSignature(song, scores);
      if (signature !== session.lastCompletedSignature) {
        session.lastCompletedSignature = signature;
        await this.dispatcher.OnSongCompleted({
          ...identity,
          song,
          scores,
        });
      }
    }

    for (const { player, playerKey } of playerTransitions) {
      session.screenByPlayerKey.set(playerKey, player.screenName);
    }
  }

  private async notifyConnected(session: LobbySession, lobbyCode: string): Promise<void> {
    if (session.currentSocketConnectedNotified) return;
    session.currentSocketConnectedNotified = true;
    await this.dispatcher.OnConnected({
      ...this.identity(session, lobbyCode.toUpperCase()),
      isActive: true,
      isConnected: true,
    });
  }

  private identity(session: LobbySession, lobbyCode: string): LobbyIdentityDto {
    return {
      tournamentId: session.tournamentId,
      lobbyId: lobbyCode,
      lobbyCode,
      lobbyName: session.lobbyName || lobbyCode,
    };
  }

  private currentIdentity(session: LobbySession): LobbyIdentityDto | null {
    return session.currentLobbyCode ? this.identity(session, session.currentLobbyCode) : null;
  }

  private toSongDto(lobby: SyncStartLobbyStatePayload): LobbySongDto | undefined {
    if (!lobby.songInfo) return undefined;
    return {
      songPath: lobby.songInfo.songPath,
      title: lobby.songInfo.title,
      artist: lobby.songInfo.artist,
      songLength: lobby.songInfo.songLength,
    };
  }

  private toLivePlayerDto(player: SyncStartLobbyPlayer): LobbyLivePlayerDto {
    return {
      playerId: player.playerId,
      playerName: this.normalizePlayerName(player.profileName),
      score: player.score ?? 0,
      exScore: player.exScore,
      isFailed: player.isFailed ?? false,
      songProgression: player.songProgression,
      judgments: this.toJudgmentsDto(player),
    };
  }

  private toCompletedScoreDto(player: SyncStartLobbyPlayer): LobbyCompletedScoreDto {
    return {
      playerId: player.playerId,
      playerName: this.normalizePlayerName(player.profileName),
      score: player.score ?? 0,
      exScore: player.exScore,
      isFailed: player.isFailed ?? false,
    };
  }

  private toJudgmentsDto(player: SyncStartLobbyPlayer): LobbyJudgmentsDto | undefined {
    if (!player.judgments) return undefined;
    return {
      fantasticPlus: player.judgments.fantasticPlus,
      fantastics: player.judgments.fantastics,
      excellents: player.judgments.excellents,
      greats: player.judgments.greats,
      decents: player.judgments.decents ?? 0,
      wayOffs: player.judgments.wayOffs ?? 0,
      misses: player.judgments.misses,
      minesHit: player.judgments.minesHit,
      holdsHeld: player.judgments.holdsHeld,
      totalHolds: player.judgments.totalHolds,
    };
  }

  private normalizePlayerName(playerName: string): string {
    return playerName.replace(/\[DS\]/g, '').replace(/\s+/g, ' ').trim();
  }

  private playerStateKey(player: SyncStartLobbyPlayer): string {
    return `${player.playerId}|${this.normalizePlayerName(player.profileName)}`;
  }

  private isEvaluationScreen(screenName: SyncStartLobbyPlayer['screenName']): boolean {
    return screenName === 'ScreenEvaluation' || screenName === 'ScreenEvaluationStage';
  }

  private completedSignature(song: LobbySongDto, scores: LobbyCompletedScoreDto[]): string {
    return JSON.stringify({
      songPath: song.songPath,
      scores: scores
        .map((score) => ({
          playerId: score.playerId,
          playerName: score.playerName,
          score: score.score,
          exScore: score.exScore,
          isFailed: score.isFailed,
        }))
        .sort((a, b) => a.playerId.localeCompare(b.playerId)),
    });
  }
}

export type {
  CreateLobbyRequestDto,
  LobbyConnectionResultDto,
  SpectateLobbyRequestDto,
  SyncStartLobbySummaryDto,
} from './syncstart-connector.types';
