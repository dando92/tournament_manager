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
 */
async function main(): Promise<void> {
  const config = readConfig();
  const logger = new Logger(config.logLevel);

  const lobby = new LegacyBridgeLobby(config, logger, (state) =>
    server.broadcast(state),
  );
  const server = new SyncStartCompatibilityServer(config, logger, lobby);

  const udp = new LegacyUdpServer(config, logger, {
    onSong: (song) => lobby.handleSong(song),
    onStart: (song) => lobby.handleStart(song),
    onScore: (message) => lobby.handleScore(message),
    onFinalScore: (message, payload) =>
      lobby.handleFinalScore(message, payload),
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
