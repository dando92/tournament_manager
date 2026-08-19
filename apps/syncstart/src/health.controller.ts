import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { RedisHealthService } from "./redis-health.service";

@Controller("health")
export class HealthController {
  constructor(private readonly redis: RedisHealthService) {}

  @Get("live") liveness() {
    return { status: "ok" };
  }

  @Get("ready") async readiness() {
    try {
      await this.redis.ping();
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
