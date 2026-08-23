import type { BridgeConfig } from "../config";
import type { LegacyScoreMessage } from "../legacy/score-message";
import type { Logger } from "../observability/logger";
import { hasJudgedItem, toJudgments } from "./judgment-mapper";
import { legacyPercentage } from "./score-normalizer";
import type {
  BridgeLobbyView,
  SyncStartJudgments,
  SyncStartLobbyPlayer,
  SyncStartLobbyState,
  SyncStartPlayerId,
  SyncStartScreenName,
} from "../syncstart/syncstart.types";

type SessionPlayer = {
  playerId: SyncStartPlayerId;
  profileName: string;
  exScore: number;
  isFailed: boolean;
  judgments: SyncStartJudgments;
  isReady: boolean;
  finalPayload: string | null;
};

export type LobbyStateListener = (state: SyncStartLobbyState) => void;

/**
 * The one virtual lobby a legacy cabinet is seen through.
 *
 * The legacy protocol says what happened; the SyncStart protocol says what a
 * machine is doing. Everything below is the translation between the two, and
 * the screen names are the load-bearing half of it: Tournament Manager reads a
 * lobby snapshot as live scores only for the players on `ScreenGameplay`, and
 * treats a song as played only when a player it last saw on `ScreenGameplay`
 * turns up on an evaluation screen. A bridge that published final scores alone,
 * as the earlier prototype did, is silent as far as the tournament is
 * concerned: every score is displayed and none is ever recorded.
 *
 * So a completed song is published as two snapshots in order: the players on
 * `ScreenGameplay` carrying their final numbers, then the same players on
 * `ScreenEvaluation`. That holds whether or not the cabinet's theme broadcasts
 * live scores at all.
 *
 * The other rule that matters is when to publish them. The reader takes the
 * whole snapshot as the result of the song, so flipping one player to
 * evaluation while the other is still playing would record the second player's
 * half-finished score, and record it a second time when they finish. The lobby
 * therefore waits until every player it has seen has sent a final message, plus
 * a short grace for a player it has not seen at all, and leaves anybody still
 * unfinished out of the completion rather than reporting a partial run.
 */
export class LegacyBridgeLobby implements BridgeLobbyView {
  private readonly players = new Map<SyncStartPlayerId, SessionPlayer>();
  private song: string | null = null;
  private isCompleted = false;
  private flushTimer: NodeJS.Timeout | null = null;
  private current: SyncStartLobbyState;
  private published: string | null = null;

  constructor(
    private readonly config: BridgeConfig,
    private readonly logger: Logger,
    private readonly listener: LobbyStateListener,
  ) {
    this.current = { players: [], spectators: [], code: config.lobbyCode };
  }

  get code(): string {
    return this.config.lobbyCode;
  }

  get isPasswordProtected(): boolean {
    return this.config.lobbyPassword !== "";
  }

  matchesPassword(password: string): boolean {
    return (password ?? "") === this.config.lobbyPassword;
  }

  state(): SyncStartLobbyState {
    return this.current;
  }

  /** A song was selected on the cabinet: whatever was played before is over. */
  handleSong(song: string): void {
    const selected = song.trim();
    if (selected === "") return;

    this.beginSession(selected);
    this.publish("ScreenSelectMusic");
  }

  /**
   * Gameplay is starting. Nobody becomes ready here: the legacy start message
   * names the song and no player, and a player is only known to the bridge once
   * the cabinet has scored them.
   */
  handleStart(song: string): void {
    const started = song.trim();
    if (started === "" || (started === this.song && !this.isCompleted)) return;

    this.beginSession(started);
    this.publish("ScreenSelectMusic");
  }

  handleScore(message: LegacyScoreMessage): void {
    this.openSessionFor(message);
    this.upsert(message, null);
    this.publish("ScreenGameplay");
  }

  handleFinalScore(message: LegacyScoreMessage, payload: string): void {
    const existing = this.players.get(playerIdOf(message));
    if (this.song === message.song && existing?.finalPayload === payload) {
      this.logger.debug("Ignoring repeated final score", {
        song: message.song,
        player: existing.profileName,
      });
      return;
    }

    this.openSessionFor(message);
    this.upsert(message, payload);
    this.scheduleFlush();
  }

  /** Stops the pending completion timer so the process can exit. */
  close(): void {
    this.clearFlushTimer();
  }

  private openSessionFor(message: LegacyScoreMessage): void {
    if (this.song === message.song && !this.isCompleted) return;
    this.beginSession(message.song);
  }

  private beginSession(song: string): void {
    this.clearFlushTimer();
    this.players.clear();
    this.song = song;
    this.isCompleted = false;
    this.logger.info("Song session started", { song, lobbyCode: this.code });
  }

  private upsert(
    message: LegacyScoreMessage,
    finalPayload: string | null,
  ): void {
    const playerId = playerIdOf(message);
    const judgments = toJudgments(message);
    const existing = this.players.get(playerId);

    this.players.set(playerId, {
      playerId,
      profileName: message.playerName,
      exScore: legacyPercentage(message),
      isFailed: message.isFailed,
      judgments,
      isReady:
        (existing?.isReady ?? false) || hasJudgedItem(judgments, message),
      finalPayload: finalPayload ?? existing?.finalPayload ?? null,
    });
  }

  private scheduleFlush(): void {
    this.clearFlushTimer();
    const waiting = [...this.players.values()].filter(
      (player) => player.finalPayload === null,
    );
    const delay =
      waiting.length > 0
        ? this.config.finalTimeoutMs
        : this.config.finalGraceMs;
    this.flushTimer = setTimeout(() => this.flush(), delay);
    this.flushTimer.unref?.();
  }

  private flush(): void {
    this.flushTimer = null;
    for (const player of [...this.players.values()]) {
      if (player.finalPayload !== null) continue;
      this.logger.warn(
        "Player reported no final score and was left out of the completion",
        {
          song: this.song,
          player: player.profileName,
        },
      );
      this.players.delete(player.playerId);
    }
    if (this.players.size === 0) return;

    this.isCompleted = true;
    this.publish("ScreenGameplay");
    this.publish("ScreenEvaluation");
    this.logger.info("Song completed", {
      song: this.song,
      players: [...this.players.values()].map((player) => ({
        playerId: player.playerId,
        profileName: player.profileName,
        exScore: player.exScore,
        isFailed: player.isFailed,
      })),
    });
  }

  /**
   * A snapshot is sent only when it says something new. The two snapshots of a
   * completion always differ from each other, so nothing a completed song
   * depends on is suppressed here.
   */
  private publish(screenName: SyncStartScreenName): void {
    const state = this.snapshot(screenName);
    const serialized = JSON.stringify(state);
    if (serialized === this.published) return;

    this.published = serialized;
    this.current = state;
    this.listener(state);
  }

  private snapshot(screenName: SyncStartScreenName): SyncStartLobbyState {
    const players: SyncStartLobbyPlayer[] = [...this.players.values()]
      .sort((left, right) => left.playerId.localeCompare(right.playerId))
      .map((player) => ({
        playerId: player.playerId,
        profileName: player.profileName,
        screenName,
        ready: screenName === "ScreenGameplay" ? player.isReady : false,
        judgments: player.judgments,
        exScore: player.exScore,
        isFailed: player.isFailed,
      }));

    return {
      players,
      spectators: [],
      code: this.code,
      ...(this.song === null
        ? {}
        : {
            songInfo: {
              songPath: this.song,
              title: this.song,
              artist: "",
              songLength: 0,
            },
          }),
    };
  }

  private clearFlushTimer(): void {
    if (!this.flushTimer) return;
    clearTimeout(this.flushTimer);
    this.flushTimer = null;
  }
}

/** `PLAYER_1 = 0` on the cabinet, and the lobby names the two sides P1 and P2. */
function playerIdOf(message: LegacyScoreMessage): SyncStartPlayerId {
  return message.playerNumber === 1 ? "P2" : "P1";
}
