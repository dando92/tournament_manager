import { ConfigService } from "@nestjs/config";
import type { DurableEventTransport } from "@tournament-manager/eventing";
import { SyncStartCommandConsumer } from "./syncstart-command.consumer";
import { SyncStartEventsPublisher } from "./syncstart-events.publisher";
import { SyncStartSessionManager } from "./syncstart-session.manager";
import { SyncStartStateStore } from "./syncstart-state.store";

describe("SyncStartCommandConsumer", () => {
  it("executes a duplicate command once and returns the cached outcome", async () => {
    const manager = {
      execute: jest.fn().mockResolvedValue({ configured: true }),
    };
    let storedOutcome;
    const state = {
      claimCommand: jest
        .fn()
        .mockImplementation(async () =>
          storedOutcome
            ? { claimed: false, outcome: storedOutcome }
            : { claimed: true },
        ),
      completeCommand: jest.fn().mockImplementation(async (_id, outcome) => {
        storedOutcome = outcome;
      }),
    };
    const consumer = new SyncStartCommandConsumer(
      new ConfigService(),
      manager as unknown as SyncStartSessionManager,
      {} as SyncStartEventsPublisher,
      state as unknown as SyncStartStateStore,
      {} as DurableEventTransport,
    );
    const event = {
      id: "command-1",
      type: "syncstart.command" as const,
      aggregateId: "7",
      payload: {
        action: "configure-tournament" as const,
        tournamentId: 7,
        syncstartUrl: "ws://simulator",
      },
    };
    await expect(consumer.handle(event)).resolves.toEqual({
      commandId: "command-1",
      ok: true,
      result: { configured: true },
    });
    await expect(consumer.handle(event)).resolves.toEqual({
      commandId: "command-1",
      ok: true,
      result: { configured: true },
    });
    expect(manager.execute).toHaveBeenCalledTimes(1);
  });

  it("does not repeat an external effect left indeterminate by an interrupted process", async () => {
    const manager = { execute: jest.fn() };
    const state = {
      claimCommand: jest.fn().mockResolvedValue({ claimed: false }),
      completeCommand: jest.fn(),
    };
    const consumer = new SyncStartCommandConsumer(
      new ConfigService(),
      manager as unknown as SyncStartSessionManager,
      {} as SyncStartEventsPublisher,
      state as unknown as SyncStartStateStore,
      {} as DurableEventTransport,
    );
    const event = {
      id: "interrupted-command",
      type: "syncstart.command" as const,
      aggregateId: "7",
      payload: { action: "create-lobby" as const, tournamentId: 7 },
    };
    await expect(consumer.handle(event)).resolves.toEqual(
      expect.objectContaining({
        commandId: event.id,
        ok: false,
        error: expect.stringContaining("indeterminate"),
      }),
    );
    expect(manager.execute).not.toHaveBeenCalled();
  });
});
