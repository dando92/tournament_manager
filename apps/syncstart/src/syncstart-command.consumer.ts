import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  SyncStartCommandEvent,
  SyncStartCommandResultPayload,
} from "@tournament-manager/contracts";
import {
  DURABLE_EVENT_TRANSPORT,
  DurableEventTransport,
} from "@tournament-manager/eventing";
import { SyncStartEventsPublisher } from "./syncstart-events.publisher";
import { SyncStartSessionManager } from "./syncstart-session.manager";
import { SyncStartStateStore } from "./syncstart-state.store";

@Injectable()
export class SyncStartCommandConsumer
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private running = false;
  private loop?: Promise<void>;
  private readonly completed = new Map<string, SyncStartCommandResultPayload>();

  constructor(
    private readonly config: ConfigService,
    private readonly manager: SyncStartSessionManager,
    private readonly events: SyncStartEventsPublisher,
    private readonly state: SyncStartStateStore,
    @Inject(DURABLE_EVENT_TRANSPORT)
    private readonly transport: DurableEventTransport,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.transport.ensureConsumerGroup(this.stream, this.group);
    this.running = true;
    this.loop = this.run();
  }

  async onApplicationShutdown(): Promise<void> {
    this.running = false;
    await this.loop;
  }

  async handle(
    event: SyncStartCommandEvent,
  ): Promise<SyncStartCommandResultPayload> {
    const cached = this.completed.get(event.id);
    if (cached) return cached;
    const claim = await this.state.claimCommand(event.id);
    if (!claim.claimed) {
      return (
        claim.outcome ?? {
          commandId: event.id,
          ok: false,
          error:
            "SyncStart command outcome is indeterminate after a process interruption; the external effect was not repeated",
        }
      );
    }
    let outcome: SyncStartCommandResultPayload;
    try {
      outcome = {
        commandId: event.id,
        ok: true,
        result: await this.manager.execute(event.payload),
      };
    } catch (error) {
      outcome = {
        commandId: event.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
    this.completed.set(event.id, outcome);
    await this.state.completeCommand(event.id, outcome);
    if (this.completed.size > 1000)
      this.completed.delete(this.completed.keys().next().value as string);
    return outcome;
  }

  private async run(): Promise<void> {
    const consumer = `syncstart-${process.pid}`;
    while (this.running) {
      try {
        const reclaimed = await this.transport.claimStale(
          this.stream,
          this.group,
          consumer,
          this.reclaimMs,
          10,
        );
        const messages =
          reclaimed.length > 0
            ? reclaimed
            : await this.transport.read(
                this.stream,
                this.group,
                consumer,
                10,
                this.blockMs,
              );
        for (const message of messages) {
          const event = message.event as SyncStartCommandEvent;
          if (event.type === "syncstart.command") {
            const outcome = await this.handle(event);
            await this.events.publishCommandResult(
              event.payload.tournamentId,
              outcome,
            );
          }
          await this.transport.acknowledge(
            this.stream,
            this.group,
            message.streamId,
          );
        }
      } catch (error) {
        if (this.running) {
          console.error(
            `[SyncStartCommandConsumer] ${error instanceof Error ? error.message : error}`,
          );
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      }
    }
  }

  private get stream(): string {
    return (
      this.config.get("SYNCSTART_COMMAND_STREAM") ??
      "tournament-manager.syncstart.commands"
    );
  }
  private get group(): string {
    return (
      this.config.get("SYNCSTART_CONSUMER_GROUP") ??
      "tournament-manager-syncstart"
    );
  }
  private get blockMs(): number {
    return Number(this.config.get("EVENT_CONSUMER_BLOCK_MS") ?? 500);
  }
  private get reclaimMs(): number {
    return Number(this.config.get("EVENT_RECLAIM_IDLE_MS") ?? 250);
  }
}
