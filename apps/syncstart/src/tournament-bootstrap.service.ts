import { HttpService } from "@nestjs/axios";
import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import { TournamentSyncStartRegistry } from "./tournament-syncstart-registry";

type ConfiguredTournament = { tournamentId: number; syncstartUrl: string };

const RETRY_DELAY_MS = 2000;

/**
 * Reconstructs replica-local tournament runtimes from the API when SyncStart starts.
 *
 * SyncStart owns no persistent state, so a restart that the API does not follow
 * leaves configured tournaments without a runtime until an operator saves the
 * tournament again. The API is still starting while SyncStart becomes ready, so
 * reconciliation retries in the background instead of blocking readiness.
 */
@Injectable()
export class TournamentBootstrapService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(TournamentBootstrapService.name);
  private retry: ReturnType<typeof setTimeout> | undefined;
  private isStopped = false;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly registry: TournamentSyncStartRegistry,
  ) {}

  onApplicationBootstrap(): void {
    void this.reconcile();
  }

  onApplicationShutdown(): void {
    this.isStopped = true;
    if (this.retry) clearTimeout(this.retry);
  }

  private async reconcile(): Promise<void> {
    if (this.isStopped) return;
    try {
      const tournaments = await this.configuredTournaments();
      let reconstructed = 0;
      for (const { tournamentId, syncstartUrl } of tournaments) {
        if (this.registry.ensureConfigured(tournamentId, syncstartUrl))
          reconstructed += 1;
      }
      this.logger.log(
        `Reconstructed ${reconstructed} of ${tournaments.length} configured tournament runtime(s).`,
      );
    } catch (error) {
      this.logger.warn(
        `Tournament reconstruction failed, retrying: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.scheduleRetry();
    }
  }

  private scheduleRetry(): void {
    if (this.isStopped) return;
    this.retry = setTimeout(() => void this.reconcile(), RETRY_DELAY_MS);
    this.retry.unref?.();
  }

  private async configuredTournaments(): Promise<ConfiguredTournament[]> {
    const response = await firstValueFrom(
      this.http.get<ConfiguredTournament[]>(
        `${this.config.getOrThrow<string>("API_INTERNAL_URL")}/internal/syncstart/tournaments`,
        {
          headers: {
            "x-internal-service-token": this.config.getOrThrow<string>(
              "INTERNAL_SERVICE_TOKEN",
            ),
          },
        },
      ),
    );
    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        `Tournament bootstrap request failed with HTTP ${response.status}`,
      );
    }
    return response.data ?? [];
  }
}
