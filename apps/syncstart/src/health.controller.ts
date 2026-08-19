import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  DURABLE_EVENT_TRANSPORT,
  DurableEventTransport,
} from "@tournament-manager/eventing";

@Controller("health")
export class HealthController {
  constructor(
    @Inject(DURABLE_EVENT_TRANSPORT)
    private readonly transport: DurableEventTransport,
  ) {}
  @Get("live") liveness() {
    return { status: "ok" };
  }
  @Get("ready") async readiness() {
    try {
      await this.transport.ensureConsumerGroup(
        "tournament-manager.syncstart.health",
        "health",
      );
      return { status: "ready", dependencies: { redis: { status: "up" } } };
    } catch (error) {
      throw new ServiceUnavailableException({
        status: "not_ready",
        dependencies: {
          redis: {
            status: "down",
            detail: error instanceof Error ? error.message : String(error),
          },
        },
      });
    }
  }
}
