import { SyncStartProtocolSimulator } from "./syncstart-protocol.simulator";

const simulator = new SyncStartProtocolSimulator({
  port: Number(process.env.SYNCSTART_SIMULATOR_PORT ?? 19000),
});
void simulator
  .url()
  .then((url) =>
    console.log(`[SyncStartProtocolSimulator] Listening on ${url}`),
  );

async function shutdown(): Promise<void> {
  await simulator.close();
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
