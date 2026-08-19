import { ServiceUnavailableException } from "@nestjs/common";
import { HealthController } from "../../src/health.controller";

describe("HealthController", () => {
  it("reports liveness without checking dependencies", () => {
    const redis = { ping: jest.fn() };
    expect(new HealthController(redis as any).liveness()).toEqual({ status: "ok" });
    expect(redis.ping).not.toHaveBeenCalled();
  });

  it("reports Redis readiness and rejects unavailable instances", async () => {
    const redis = { ping: jest.fn().mockResolvedValue(undefined) };
    const controller = new HealthController(redis as any);
    await expect(controller.readiness()).resolves.toEqual({
      status: "ready",
      dependencies: { redis: { status: "up" } },
    });

    redis.ping.mockRejectedValueOnce(new Error("unavailable"));
    await expect(controller.readiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
