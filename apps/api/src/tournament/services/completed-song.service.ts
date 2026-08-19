import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ScoringSystemProvider } from '@tournament-manager/application';
import {
  CompletedSongRequest,
  EventEnvelope,
  LiveEventEnvelope,
  SyncStartSongCompletedEvent,
  SyncStartSongCompletedPayload,
} from '@tournament-manager/contracts';
import {
  LIVE_EVENT_TRANSPORT,
  LiveEventTransport,
} from '@tournament-manager/eventing';
import { DataSource, EntityManager, In } from 'typeorm';
import {
  Match,
  Participant,
  Round,
  Score,
  Song,
  Standing,
} from '@tournament-manager/persistence';

export interface LobbySongCompletedEffect {
  matchUpdates: Array<{
    tournamentId: number;
    divisionId: number;
    phaseId: number;
    phaseGroupId: number;
    matchId: number;
  }>;
  warnings: string[];
}

type CompletedScore = SyncStartSongCompletedPayload['scores'][number];

@Injectable()
export class CompletedSongService {
  private readonly completions = new Set<string>();

  constructor(
    private readonly dataSource: DataSource,
    private readonly scoringSystems: ScoringSystemProvider,
    private readonly config: ConfigService,
    @Inject(LIVE_EVENT_TRANSPORT)
    private readonly liveTransport: LiveEventTransport,
  ) {}

  async submit(request: CompletedSongRequest): Promise<void> {
    if (this.completions.has(request.completionId)) return;
    const event: SyncStartSongCompletedEvent = {
      id: request.completionId,
      type: 'syncstart.song-completed',
      aggregateId: String(request.tournamentId),
      payload: request,
    };
    const effect = await this.dataSource.transaction((manager) => this.handle(manager, event));
    await this.afterCommit(event, effect);
    this.completions.add(request.completionId);
  }

  async handle(
    manager: EntityManager,
    event: EventEnvelope,
  ): Promise<LobbySongCompletedEffect> {
    const completedEvent = event as SyncStartSongCompletedEvent;
    const matchIds = new Set<number>();
    const warnings: string[] = [];

    for (const completedScore of completedEvent.payload.scores) {
      if (completedScore.exScore == null) {
        warnings.push(this.missingExScoreWarning(completedEvent, completedScore));
        continue;
      }

      const result = await this.persistScore(
        manager,
        completedEvent.payload,
        completedScore,
      );
      if (result.warning) warnings.push(result.warning);
      if (result.matchId) matchIds.add(result.matchId);
    }

    const matches = await manager.getRepository(Match).find({
      where: { id: In([...matchIds]) },
      relations: { phaseGroup: { phase: { division: { tournament: true } } } },
    });
    return {
      matchUpdates: matches.map((match) => ({
        tournamentId: completedEvent.payload.tournamentId,
        divisionId: match.phaseGroup.phase.division.id,
        phaseId: match.phaseGroup.phase.id,
        phaseGroupId: match.phaseGroup.id,
        matchId: match.id,
      })),
      warnings,
    };
  }

  async afterCommit(event: EventEnvelope, result: unknown): Promise<void> {
    const completed = event as SyncStartSongCompletedEvent;
    const effect = result as LobbySongCompletedEffect;
    for (const warning of effect.warnings) {
      await this.publish(completed.payload.tournamentId, 'ui.warning', {
        message: warning,
      });
    }
    for (const matchUpdate of effect.matchUpdates) {
      await this.publish(completed.payload.tournamentId, 'ui.match-changed', {
        ...matchUpdate,
      });
    }
  }

  private async persistScore(
    manager: EntityManager,
    payload: SyncStartSongCompletedPayload,
    completedScore: CompletedScore,
  ): Promise<{ matchId?: number; warning?: string }> {
    const participant = await this.getParticipant(
      manager,
      payload.tournamentId,
      completedScore.playerName,
    );
    const song = await this.getSong(manager, payload);
    if (!participant?.player || !song) {
      return { warning: this.missingPlayerSongWarning(payload, completedScore) };
    }

    const activeMatches = await this.findActiveMatches(
      manager,
      payload.tournamentId,
    );
    const targetMatch = this.findTargetMatch(
      activeMatches,
      song.id,
      participant.player.id,
    );
    const score = await this.saveScore(
      manager,
      participant,
      song,
      completedScore,
    );
    if (!targetMatch) return {};

    const targetRound = this.getTargetRound(targetMatch, song.id);
    if (!targetRound) {
      return { warning: this.unresolvedTargetWarning(payload, completedScore) };
    }

    await this.addStanding(manager, targetRound, score);
    await this.recalculateCompletedRound(manager, targetMatch, targetRound);
    return { matchId: targetMatch.id };
  }

  private getParticipant(
    manager: EntityManager,
    tournamentId: number,
    playerName: string,
  ): Promise<Participant | null> {
    return manager
      .getRepository(Participant)
      .createQueryBuilder('participant')
      .leftJoinAndSelect('participant.player', 'player')
      .where('participant.tournamentId = :tournamentId', { tournamentId })
      .andWhere('LOWER(TRIM(player.playerName)) = :normalizedName', {
        normalizedName: playerName.trim().toLowerCase(),
      })
      .getOne();
  }

  private getSong(
    manager: EntityManager,
    payload: SyncStartSongCompletedPayload,
  ): Promise<Song | null> {
    return manager.getRepository(Song).findOne({
      where: {
        title: payload.song.songPath,
        tournament: { id: payload.tournamentId },
      },
    });
  }

  private findActiveMatches(
    manager: EntityManager,
    tournamentId: number,
  ): Promise<Match[]> {
    return manager.getRepository(Match).find({
      where: {
        active: true,
        phaseGroup: {
          phase: { division: { tournament: { id: tournamentId } } },
        },
      },
      relations: {
        entrants: { participants: { player: true } },
        rounds: {
          song: true,
          standings: { score: { player: true, song: true } },
        },
      },
    });
  }

  private findTargetMatch(
    matches: Match[],
    songId: number,
    playerId: number,
  ): Match | undefined {
    return matches
      .filter(
        (match) =>
          match.rounds?.some((round) => round.song?.id === songId) &&
          this.getSinglesPlayerIds(match).includes(playerId),
      )
      .find((match) => {
        const round = this.getTargetRound(match, songId);
        return !round?.standings?.some(
          (standing) =>
            standing.score.player.id === playerId &&
            standing.score.song.id === songId,
        );
      });
  }

  private saveScore(
    manager: EntityManager,
    participant: Participant,
    song: Song,
    completedScore: CompletedScore,
  ): Promise<Score> {
    const score = manager.getRepository(Score).create({
      player: participant.player,
      song,
      percentage: completedScore.exScore,
      isFailed: completedScore.isFailed,
    });
    return manager.getRepository(Score).save(score);
  }

  private getTargetRound(match: Match, songId: number): Round | undefined {
    return match.rounds.find((round) => round.song.id === songId);
  }

  private async addStanding(
    manager: EntityManager,
    round: Round,
    score: Score,
  ): Promise<void> {
    const standing = manager.getRepository(Standing).create({
      round,
      score,
      points: 0,
    });
    await manager.getRepository(Standing).save(standing);
    round.standings.push(standing);
  }

  private async recalculateCompletedRound(
    manager: EntityManager,
    match: Match,
    round: Round,
  ): Promise<void> {
    const playerIds = this.getSinglesPlayerIds(match);
    const isComplete = playerIds.every((playerId) =>
      round.standings.some(
        (standing) => standing.score.player.id === playerId,
      ),
    );
    if (!isComplete) return;

    const scoringSystem = this.scoringSystems.getScoringSystem(
      match.scoringSystem,
    );
    if (!scoringSystem) {
      throw new Error(`Unknown scoring system ${match.scoringSystem}`);
    }
    scoringSystem.recalc(round.standings);
    await manager.getRepository(Standing).save(round.standings);
  }

  private getSinglesPlayerIds(match: Match): number[] {
    return (match.entrants ?? [])
      .filter((entrant) => entrant.type === 'player')
      .map((entrant) => entrant.participants?.[0]?.player?.id)
      .filter((id): id is number => Number.isFinite(id));
  }

  private missingExScoreWarning(
    event: SyncStartSongCompletedEvent,
    score: CompletedScore,
  ): string {
    return `No EX score found for ${score.playerName} on "${event.payload.song.songPath}". Score was not saved.`;
  }

  private missingPlayerSongWarning(
    payload: SyncStartSongCompletedPayload,
    score: CompletedScore,
  ): string {
    return `No database player-song found for ${score.playerName} on "${payload.song.songPath}". Score was not saved.`;
  }

  private unresolvedTargetWarning(
    payload: SyncStartSongCompletedPayload,
    score: CompletedScore,
  ): string {
    return `Unable to resolve score target for ${score.playerName} on "${payload.song.songPath}". Score was not saved.`;
  }

  private publish(
    tournamentId: number,
    type: string,
    payload: unknown,
  ): Promise<void> {
    const event: LiveEventEnvelope = { type, tournamentId, payload };
    return this.liveTransport.publish(
      this.config.get('LIVE_EVENT_CHANNEL') ?? 'tournament-manager.live',
      event,
    );
  }
}

