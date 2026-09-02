import { readConfig } from "./config";
import { LegacyBridgeLobby } from "./domain/bridge-lobby";
import { LegacyUdpServer } from "./legacy/udp-server";
import { Logger } from "./observability/logger";
import { SyncStartCompatibilityServer } from "./syncstart/websocket-server";

/**
 * One legacy cabinet room, seen by Tournament Manager as one SyncStart lobby.
 *
 * The three parts are wired here and nowhere else: the UDP listener turns
 * datagrams into legacy messages, the lobby turns those into SyncStart
 * snapshots, and the WebSocket server publishes them to whoever is attached.
 * Every message carries the address it came from, which is how the lobby tells
 * the cabinets of the room apart.
 */
async function main(): Promise<void> {
  const config = readConfig();
  const logger = new Logger(config.logLevel);

  let server: SyncStartCompatibilityServer;
  const lobby = new LegacyBridgeLobby(config, logger, (state) =>
    server.broadcast(state),
  );
  const udp = new LegacyUdpServer(config, logger, {
    onSong: (address, song) => lobby.handleSong(address, song),
    onStart: (address, song) => lobby.handleStart(address, song),
    onScore: (address, message) => lobby.handleScore(address, message),
    onFinalScore: (address, message, payload) =>
      lobby.handleFinalScore(address, message, payload),
  });
  server = new SyncStartCompatibilityServer(config, logger, lobby, {
    selectSong: (songPath) => udp.selectSong(songPath),
    startSong: (songPath) => udp.startSong(songPath),
  });

  await udp.listen();
  const port = await server.listening();
  logger.info("Legacy SyncStart bridge ready", {
    lobbyCode: config.lobbyCode,
    isPasswordProtected: config.lobbyPassword !== "",
    webSocketUrl: `ws://0.0.0.0:${port}`,
  });

  let stopping = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (stopping) return;
    stopping = true;
    logger.info("Shutting down", { signal });
    lobby.close();
    await Promise.all([udp.close(), server.close()]);
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      service: "legacy-syncstart-bridge",
      message: `Startup failed: ${message}`,
    }),
  );
  process.exit(1);
});
