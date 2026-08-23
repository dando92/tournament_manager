import { Injectable } from '@nestjs/common';
import { CompletedSongRequest, LobbyCompletedScoreDto } from '@tournament-manager/contracts';

import { CompletedRun, MatchCommands } from '@match/match.commands';
import { MatchQueries } from '@match/match.queries';
import { UiUpdatePublisher } from '@match/services/ui-update.publisher';
import { SongQueries } from '@tournament/catalog/song.queries';
import { RunInput, ScoreStore } from '@tournament/competition/score.store';
import { ParticipantQueries } from '@tournament/registration/participants.queries';

/** A reported score, once it is known who and what it is about. */
type ResolvedRun = RunInput;

/** The same run once it is written down, which is what a round is handed. */
type RecordedRun = RunInput & { scoreId: number };

/**
 * What a lobby reports when everybody in it has finished a song.
 *
 * This is the ingestion half of an integration: it takes the shape SyncStart
 * sends, works out who and what each score is about, and hands the change to
 * the aggregate that owns it. It used to be the whole path — it opened its own
 * transaction, wrote standings, ran the scoring system and published events
 * from outside the match — with one load of every active match of the
 * tournament, its entrants and every score in it, per player in the lobby.
 *
 * Three reads resolve a whole lobby now, whatever its size: who the names are,
 * which song of the pool was played, and which rounds were waiting for it. Each
 * match those rounds belong to is then written once through
 * `MatchCommands.applyCompletedSong`, which is the same aggregate call a person
 * makes by choosing an existing run in the standing dialog.
 *
 * A run is recorded whether or not a round was waiting for it. A percentage is
 * evidence of something somebody played, and a lobby played outside a tracked
 * match still leaves the run that the dialog offers later.
 */
@Injectable()
export class CompletedSongService {
  /* SyncStart retries a completion it did not hear back about, and the same
     completion must not be scored twice. This is volatile and per instance,
     which is what it was before: the durable form of it is the inbox the
     architecture defers until there is a second writer. */
  private readonly completions = new Set<string>();

  constructor(
    private readonly songs: SongQueries,
    private readonly participants: ParticipantQueries,
    private readonly matches: MatchQueries,
    private readonly matchCommands: MatchCommands,
    private readonly scores: ScoreStore,
    private readonly publisher: UiUpdatePublisher,
  ) {}

  async submit(request: CompletedSongRequest): Promise<void> {
    if (this.completions.has(request.completionId)) return;

    const { runs, warnings } = await this.resolve(request);
    for (const warning of warnings) await this.publisher.emitWarning(request.tournamentId, warning);

    const recorded = await this.scores.record(runs);
    const written = runs.map((run, index) => ({ ...run, scoreId: recorded[index].id }));

    for (const [matchId, played] of await this.targets(request.tournamentId, written)) {
      await this.matchCommands.applyCompletedSong(matchId, played);
    }

    this.completions.add(request.completionId);
  }

  /**
   * The scores that name somebody this tournament knows, on a song its pool
   * holds. Everything else is a warning that says the run was not saved.
   */
  private async resolve(request: CompletedSongRequest): Promise<{ runs: ResolvedRun[]; warnings: string[] }> {
    const played = request.scores.filter((score) => score.exScore != null);
    const warnings = request.scores
      .filter((score) => score.exScore == null)
      .map((score) => this.missingExScoreWarning(request, score));

    const songId = await this.songs.idByTitle(request.tournamentId, request.song.songPath);
    const playerIds = songId
      ? await this.participants.playerIdsByNames(request.tournamentId, played.map((score) => score.playerName))
      : new Map<string, number>();

    const runs: ResolvedRun[] = [];
    for (const score of played) {
      const playerId = playerIds.get(score.playerName.trim().toLowerCase());
      if (!songId || !playerId) {
        warnings.push(this.missingPlayerSongWarning(request, score));
        continue;
      }

      runs.push({ playerId, songId, percentage: score.exScore, isFailed: score.isFailed });
    }

    return { runs, warnings };
  }

  /**
   * The runs each match is owed, from the one query that asks which rounds were
   * waiting. A run nothing was waiting for stays recorded and names no match.
   */
  private async targets(tournamentId: number, runs: RecordedRun[]): Promise<Map<number, CompletedRun[]>> {
    if (runs.length === 0) return new Map();

    const scoreIdByPlayer = new Map(runs.map((run) => [run.playerId, run.scoreId]));
    const rounds = await this.matches.liveTargetsForSong(tournamentId, runs[0].songId, [...scoreIdByPlayer.keys()]);
    const byMatch = new Map<number, CompletedRun[]>();

    for (const round of rounds) {
      const run = { roundId: round.roundId, playerId: round.playerId, scoreId: scoreIdByPlayer.get(round.playerId) };
      byMatch.set(round.matchId, [...(byMatch.get(round.matchId) ?? []), run]);
    }

    return byMatch;
  }

  private missingExScoreWarning(request: CompletedSongRequest, score: LobbyCompletedScoreDto): string {
    return `No EX score found for ${score.playerName} on "${request.song.songPath}". Score was not saved.`;
  }

  private missingPlayerSongWarning(request: CompletedSongRequest, score: LobbyCompletedScoreDto): string {
    return `No database player-song found for ${score.playerName} on "${request.song.songPath}". Score was not saved.`;
  }
}
