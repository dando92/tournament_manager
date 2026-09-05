import type { BridgeConfig } from "../config";
import type { LegacyScoreMessage } from "../legacy/score-message";
import type { Logger } from "../observability/logger";
import { hasJudgedItem, toJudgments } from "./judgment-mapper";
import { isEphemeralScore, legacyPercentage } from "./score-normalizer";
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

/**
 * One cabinet, addressed by the source of its datagrams.
 *
 * `Machine` on the real SyncStart server is `{ player1, player2, socketId }`
 * held in `Lobby.machines`, keyed by the socket the cabinet connected on. A
 * broadcast socket has no per-sender connection, so the source address takes
 * the socket's place: it is the only thing that tells one cabinet's `P1` from
 * another's, since every cabinet numbers its own side `PLAYER_1 = 0`.
 */
type Machine = {
  address: string;
  players: Map<SyncStartPlayerId, SessionPlayer>;
  song: string | null;
  lastSeenAt: number;
};

export type LobbyStateListener = (state: SyncStartLobbyState) => void;

/** `joinLobby` answers "Too many machines in the lobby" past the fourth. */
export const MAX_MACHINES = 4;

/**
 * The one virtual lobby a room of legacy cabinets is seen through.
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
 * evaluation while another is still playing would record the second player's
 * half-finished score, and record it a second time when they finish. The lobby
 * therefore waits until every player it has seen has sent a final message, plus
 * a short grace for a player it has not seen at all, and leaves anybody still
 * unfinished out of the completion rather than reporting a partial run. That
 * wait spans the whole room, not one cabinet: a lobby of three machines
 * completes once, when the last of them has finished.
 *
 * Several cabinets are one lobby here, as they are on the real server, whose
 * `Lobby.machines` holds up to four of them and whose `getLobbyState` flattens
 * every machine's `player1` and `player2` into a single `players` array with
 * the socket ids omitted. Two players called `P1` in one snapshot is therefore
 * the ordinary shape of a multi-cabinet lobby and not a collision: the reader
 * keys a player on `playerId` and `profileName` together.
 */
export class LegacyBridgeLobby implements BridgeLobbyView {
  private readonly machines = new Map<string, Machine>();
  private song: string | null = null;
  private isCompleted = false;
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly idleTimer: NodeJS.Timeout;
  private current: SyncStartLobbyState;
  private published: string | null = null;

  constructor(
    private readonly config: BridgeConfig,
    private readonly logger: Logger,
    private readonly listener: LobbyStateListener,
  ) {
    this.current = { players: [], spectators: [], code: config.lobbyCode };
    this.idleTimer = setInterval(
      () => this.evictIdleMachines(),
      config.machineIdleMs,
    );
    this.idleTimer.unref?.();
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

  /** A song was selected on a cabinet: whatever it played before is over. */
  handleSong(address: string, song: string): void {
    const selected = song.trim();
    if (selected === "") return;

    const machine = this.machineFor(address);
    if (!machine) return;

    this.moveTo(machine, selected);
    if (!this.isInSession(machine)) return;

    this.publish("ScreenSelectMusic");
  }

  /**
   * Gameplay is starting. Nobody becomes ready here: the legacy start message
   * names the song and no player, and a player is only known to the bridge once
   * the cabinet has scored them.
   */
  handleStart(address: string, song: string): void {
    const started = song.trim();
    if (started === "") return;

    const machine = this.machineFor(address);
    if (!machine) return;
    if (machine.song === started && this.song === started && !this.isCompleted)
      return;

    this.moveTo(machine, started);
    if (!this.isInSession(machine)) return;

    this.publish("ScreenSelectMusic");
  }

  handleScore(address: string, message: LegacyScoreMessage): void {
    const machine = this.machineFor(address);
    if (!machine) return;

    this.moveTo(machine, message.song);
    if (!this.isInSession(machine)) return;

    this.upsert(machine, message, null);
    this.publish("ScreenGameplay");
  }

  handleFinalScore(
    address: string,
    message: LegacyScoreMessage,
    payload: string,
  ): void {
    const machine = this.machineFor(address);
    if (!machine) return;

    if (isEphemeralScore(message)) {
      this.discardEphemeral(machine, message);
      return;
    }

    const existing = machine.players.get(playerIdOf(message));
    if (machine.song === message.song && existing?.finalPayload === payload) {
      this.logger.debug("Ignoring repeated final score", {
        machine: machine.address,
        song: message.song,
        player: existing.profileName,
      });
      return;
    }

    this.moveTo(machine, message.song);
    if (!this.isInSession(machine)) return;

    this.upsert(machine, message, payload);
    this.scheduleFlush();
  }

  /**
   * A skipped song leaves its player out of the run entirely, and a completion
   * the room is already waiting on stops waiting for them.
   */
  private discardEphemeral(
    machine: Machine,
    message: LegacyScoreMessage,
  ): void {
    this.logger.info("Ignoring the score of a skipped song", {
      machine: machine.address,
      song: message.song,
      player: message.playerName,
    });

    const left =
      this.isInSession(machine) &&
      machine.song === message.song &&
      machine.players.delete(playerIdOf(message));
    if (!left) {
      return;
    }

    if (this.flushTimer) {
      this.scheduleFlush();
    }
    this.publish("ScreenGameplay");
  }

  /** Stops the pending timers so the process can exit. */
  close(): void {
    this.clearFlushTimer();
    clearInterval(this.idleTimer);
  }

  /**
   * A datagram source is a machine, the way a socket is one on the real server,
   * and it joins the lobby by being heard from. The fifth one is refused, which
   * is what `joinLobby` does past `machines.length >= 4`: a venue runs four
   * cabinets at most, and anything beyond that is a stranger broadcasting on
   * the segment rather than a cabinet the tournament is waiting for.
   */
  private machineFor(address: string): Machine | null {
    const existing = this.machines.get(address);
    if (existing) {
      existing.lastSeenAt = Date.now();
      return existing;
    }

    if (this.machines.size >= MAX_MACHINES) {
      this.logger.warn("Too many machines in the lobby, ignoring the datagram", {
        machine: address,
        lobbyCode: this.code,
        limit: MAX_MACHINES,
      });
      return null;
    }

    const machine: Machine = {
      address,
      players: new Map(),
      song: null,
      lastSeenAt: Date.now(),
    };
    this.machines.set(address, machine);
    this.logger.info("Machine joined the lobby", {
      machine: address,
      lobbyCode: this.code,
    });
    return machine;
  }

  /**
   * A machine moved to a song, and what the lobby makes of it.
   *
   * The real server keeps one `songInfo` for the whole lobby and every machine
   * in it plays that song — it refuses a machine outright while a song is
   * selected. A cabinet that announces a different one mid-session is therefore
   * out of the lobby's song rather than the start of a new one: it is left out
   * of the published snapshot and out of the completion, and nobody else's run
   * is cleared by it. The lobby moves on when its song is finished, or once
   * every machine has left that song behind.
   *
   * A machine that leaves publishes nothing of its own, because the screen it
   * moved to is its own and not the room's: announcing it would flip the
   * cabinets still playing out of `ScreenGameplay`. Its players drop out of the
   * next snapshot a cabinet in the session triggers, which while somebody is
   * playing is the very next score datagram.
   */
  private moveTo(machine: Machine, song: string): void {
    if (machine.song !== song) {
      machine.players.clear();
      machine.song = song;
    }
    if (this.song === song && !this.isCompleted) return;

    if (this.song === null || this.isCompleted || this.everyMachineMovedOn()) {
      this.beginSession(song);
      return;
    }

    this.logger.warn("Machine is on another song and is left out of the lobby", {
      machine: machine.address,
      song,
      lobbySong: this.song,
    });
  }

  /** The lobby's song is over once no machine is playing it any more. */
  private everyMachineMovedOn(): boolean {
    return [...this.machines.values()].every(
      (machine) => machine.song !== this.song,
    );
  }

  private beginSession(song: string): void {
    this.clearFlushTimer();
    for (const machine of this.machines.values()) {
      machine.players.clear();
      if (machine.song !== song) machine.song = null;
    }
    this.song = song;
    this.isCompleted = false;
    this.logger.info("Song session started", { song, lobbyCode: this.code });
  }

  private isInSession(machine: Machine): boolean {
    return machine.song !== null && machine.song === this.song;
  }

  /** The machines on the lobby's song, in a stable order for the snapshot. */
  private sessionMachines(): Machine[] {
    return [...this.machines.values()]
      .filter((machine) => this.isInSession(machine))
      .sort((left, right) => left.address.localeCompare(right.address));
  }

  private sessionPlayers(): SessionPlayer[] {
    return this.sessionMachines().flatMap((machine) =>
      [...machine.players.values()].sort((left, right) =>
        left.playerId.localeCompare(right.playerId),
      ),
    );
  }

  private upsert(
    machine: Machine,
    message: LegacyScoreMessage,
    finalPayload: string | null,
  ): void {
    const playerId = playerIdOf(message);
    const judgments = toJudgments(message);
    const existing = machine.players.get(playerId);

    machine.players.set(playerId, {
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
    const waiting = this.sessionPlayers().filter(
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
    for (const machine of this.sessionMachines()) {
      for (const player of [...machine.players.values()]) {
        if (player.finalPayload !== null) continue;
        this.logger.warn(
          "Player reported no final score and was left out of the completion",
          {
            machine: machine.address,
            song: this.song,
            player: player.profileName,
          },
        );
        machine.players.delete(player.playerId);
      }
    }
    if (this.sessionPlayers().length === 0) return;

    this.isCompleted = true;
    this.publish("ScreenGameplay");
    this.publish("ScreenEvaluation");
    this.logger.info("Song completed", {
      song: this.song,
      machines: this.sessionMachines().length,
      players: this.sessionPlayers().map((player) => ({
        playerId: player.playerId,
        profileName: player.profileName,
        exScore: player.exScore,
        isFailed: player.isFailed,
      })),
    });
  }

  /**
   * A machine leaves the real server when its socket closes, and nothing closes
   * on a broadcast socket. So a cabinet that has been quiet for `machineIdleMs`
   * is dropped instead: its players leave the snapshot, and a completion stops
   * waiting for a run whose end it will never hear.
   *
   * A cabinet that has already finished is kept while the completion it is part
   * of is still pending, however quiet it has been. It falls silent precisely
   * because it is done, and dropping it would delete the very run the lobby is
   * waiting to report — which is what would happen to every cabinet at once if
   * `MACHINE_IDLE_MS` were ever set below `FINAL_TIMEOUT_MS`.
   *
   * A completed song is left alone. Its snapshot has already been read as the
   * result of the song, and republishing it a player short would be read as a
   * second, different result for the same song.
   */
  private evictIdleMachines(): void {
    const deadline = Date.now() - this.config.machineIdleMs;
    let evicted = false;

    for (const machine of [...this.machines.values()]) {
      if (machine.lastSeenAt > deadline) continue;
      if (this.flushTimer && this.hasFinished(machine)) continue;
      this.machines.delete(machine.address);
      evicted = true;
      this.logger.info("Machine went quiet and left the lobby", {
        machine: machine.address,
        lobbyCode: this.code,
      });
    }

    if (!evicted || this.isCompleted) return;
    if (this.flushTimer) this.scheduleFlush();
    this.publish("ScreenGameplay");
  }

  /** Everything this machine is playing has already reported its final score. */
  private hasFinished(machine: Machine): boolean {
    return (
      machine.players.size > 0 &&
      [...machine.players.values()].every(
        (player) => player.finalPayload !== null,
      )
    );
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
    const players: SyncStartLobbyPlayer[] = this.sessionPlayers().map(
      (player) => ({
        playerId: player.playerId,
        profileName: player.profileName,
        screenName,
        ready: screenName === "ScreenGameplay" ? player.isReady : false,
        judgments: player.judgments,
        exScore: player.exScore,
        isFailed: player.isFailed,
      }),
    );

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
