import { Injectable } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import type { LobbySongCompletedDto } from "@tournament-manager/contracts";
import type { ILobbyObserver } from "@tournament-manager/syncstart-protocol";

@Injectable()
export class CompletedSongSubmitter implements ILobbyObserver {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  async OnSongCompleted(event: LobbySongCompletedDto): Promise<void> {
    const response = await firstValueFrom(
      this.http.post(
        `${this.config.getOrThrow<string>("API_INTERNAL_URL")}/internal/syncstart/completed-songs`,
        {
          ...event,
          completionId: `${event.tournamentId}:${event.lobbyId}:${event.song.songPath}:${event.scores.map((score) => `${score.playerId}:${score.exScore}`).join(",")}`,
        },
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
        `Completed-song submission failed with HTTP ${response.status}`,
      );
    }
  }
}
