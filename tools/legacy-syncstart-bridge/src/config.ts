import type { LogLevel } from "./observability/logger";

/** Everything the bridge needs, read from the environment once and validated. */
export type BridgeConfig = {
  udpPort: number;
  udpAllowedSources: string[];
  webSocketPort: number;
  maxPayloadBytes: number;
  heartbeatIntervalMs: number;
  lobbyCode: string;
  lobbyPassword: string;
  finalGraceMs: number;
  finalTimeoutMs: number;
  machineIdleMs: number;
  logLevel: LogLevel;
};

const LOG_LEVELS: LogLevel[] = ["debug", "info", "warn", "error"];

/**
 * A bad value stops the process here rather than at the first packet.
 *
 * `finalGraceMs` and `finalTimeoutMs` are the two halves of one rule: a song is
 * complete when every player it saw has sent a final message, and the grace is
 * how long the bridge still waits for a player it has not seen at all — a
 * cabinet whose theme broadcasts no live scores only names its second player
 * when that player finishes. The timeout is the other end: somebody who started
 * and never finished must not hold a completed song forever.
 *
 * `machineIdleMs` is the third of them and belongs to the cabinets rather than
 * the players: a machine leaves the real SyncStart server when its socket
 * closes, and nothing closes on a broadcast socket, so a cabinet is considered
 * gone once it has been quiet for this long. It is generous on purpose. A
 * cabinet is quiet through every menu, every pack browse and every break
 * between matches, and dropping one is only meant to describe a cabinet that
 * has left the room. A cabinet dropped early is not lost — the next datagram
 * registers it again, and legacy counters are cumulative, so one packet
 * restores the whole player — but it would leave the lobby briefly claiming
 * fewer machines than the room holds.
 */
export function readConfig(env: NodeJS.ProcessEnv = process.env): BridgeConfig {
  return {
    udpPort: port(env.SYNCSTART_UDP_PORT, 53000, "SYNCSTART_UDP_PORT"),
    udpAllowedSources: list(env.UDP_ALLOWED_SOURCES),
    webSocketPort: port(env.WS_PORT ?? env.PORT, 1337, "WS_PORT"),
    maxPayloadBytes: positive(
      env.WS_MAX_PAYLOAD_BYTES,
      64 * 1024,
      "WS_MAX_PAYLOAD_BYTES",
    ),
    heartbeatIntervalMs: positive(
      env.WS_HEARTBEAT_INTERVAL_MS,
      30000,
      "WS_HEARTBEAT_INTERVAL_MS",
    ),
    lobbyCode: lobbyCode(env.LOBBY_CODE),
    lobbyPassword: env.LOBBY_PASSWORD ?? "",
    finalGraceMs: positive(env.FINAL_GRACE_MS, 1500, "FINAL_GRACE_MS"),
    finalTimeoutMs: positive(env.FINAL_TIMEOUT_MS, 20000, "FINAL_TIMEOUT_MS"),
    machineIdleMs: positive(env.MACHINE_IDLE_MS, 600000, "MACHINE_IDLE_MS"),
    logLevel: logLevel(env.LOG_LEVEL),
  };
}

function port(
  value: string | undefined,
  fallback: number,
  name: string,
): number {
  const parsed = positive(value, fallback, name);
  if (parsed > 65535) throw new Error(`${name} must be a port number`);
  return parsed;
}

function positive(
  value: string | undefined,
  fallback: number,
  name: string,
): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer, received "${value}"`);
  }
  return parsed;
}

function lobbyCode(value: string | undefined): string {
  const code = (value ?? "BRDG").trim().toUpperCase();
  if (!/^[A-Z0-9]{1,8}$/.test(code)) {
    throw new Error(
      `LOBBY_CODE must be 1 to 8 letters or digits, received "${value}"`,
    );
  }
  return code;
}

function list(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function logLevel(value: string | undefined): LogLevel {
  const level = (value ?? "info").trim().toLowerCase();
  if (!LOG_LEVELS.includes(level as LogLevel)) {
    throw new Error(
      `LOG_LEVEL must be one of ${LOG_LEVELS.join(", ")}, received "${value}"`,
    );
  }
  return level as LogLevel;
}
