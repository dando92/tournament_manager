import { of } from "rxjs";
import { TournamentBootstrapService } from "../../src/tournament-bootstrap.service";

describe("TournamentBootstrapService", () => {
  const config = {
    getOrThrow: jest.fn((key: string) =>
      key === "API_INTERNAL_URL" ? "http://api" : "secret",
    ),
  };
  const configured = [{ tournamentId: 7, syncstartUrl: "ws://syncstart:1337" }];
  const registry = () => ({ ensureConfigured: jest.fn().mockReturnValue(true) });

  afterEach(() => jest.useRealTimers());

  it("reconstructs every configured tournament reported by the API", async () => {
    const http = {
      get: jest.fn().mockReturnValue(of({ status: 200, data: configured })),
    };
    const target = registry();

    new TournamentBootstrapService(
      http as any,
      config as any,
      target as any,
    ).onApplicationBootstrap();
    await new Promise(setImmediate);

    expect(http.get).toHaveBeenCalledWith(
      "http://api/internal/syncstart/tournaments",
      { headers: { "x-internal-service-token": "secret" } },
    );
    expect(target.ensureConfigured).toHaveBeenCalledWith(7, "ws://syncstart:1337");
  });

  it("retries until the API becomes reachable", async () => {
    jest.useFakeTimers();
    const http = {
      get: jest
        .fn()
        .mockImplementationOnce(() => {
          throw new Error("connect ECONNREFUSED");
        })
        .mockReturnValue(of({ status: 200, data: configured })),
    };
    const target = registry();

    new TournamentBootstrapService(
      http as any,
      config as any,
      target as any,
    ).onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(0);
    expect(target.ensureConfigured).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(2000);
    expect(target.ensureConfigured).toHaveBeenCalledWith(7, "ws://syncstart:1337");
  });

  it("stops retrying once the application shuts down", async () => {
    jest.useFakeTimers();
    const http = {
      get: jest.fn().mockImplementation(() => {
        throw new Error("connect ECONNREFUSED");
      }),
    };
    const service = new TournamentBootstrapService(
      http as any,
      config as any,
      registry() as any,
    );

    service.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(0);
    service.onApplicationShutdown();
    await jest.advanceTimersByTimeAsync(10000);

    expect(http.get).toHaveBeenCalledTimes(1);
  });

  it("reports a failing bootstrap response as a retryable failure", async () => {
    jest.useFakeTimers();
    const http = { get: jest.fn().mockReturnValue(of({ status: 503 })) };
    const target = registry();

    new TournamentBootstrapService(
      http as any,
      config as any,
      target as any,
    ).onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(0);

    expect(target.ensureConfigured).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(2000);
    expect(http.get).toHaveBeenCalledTimes(2);
  });
});
