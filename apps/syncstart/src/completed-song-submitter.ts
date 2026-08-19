import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { LobbySongCompletedDto } from "@tournament-manager/contracts";
import type { ILobbyObserver } from "@tournament-manager/syncstart-protocol";

@Injectable()
export class CompletedSongSubmitter implements ILobbyObserver {
  constructor(private readonly config: ConfigService) {}

  async OnSongCompleted(event: LobbySongCompletedDto): Promise<void> {
    const response = await fetch(
      `${this.config.getOrThrow<string>("API_INTERNAL_URL")}/internal/syncstart/completed-songs`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-service-token": this.config.getOrThrow<string>(
            "INTERNAL_SERVICE_TOKEN",
          ),
        },
        body: JSON.stringify({
          ...event,
          completionId: `${event.tournamentId}:${event.lobbyId}:${event.song.songPath}:${event.scores.map((score) => `${score.playerId}:${score.exScore}`).join(",")}`,
        }),
      },
    );
    if (!response.ok) {
      throw new Error(
        `Completed-song submission failed with HTTP ${response.status}`,
      );
    }
  }
}
