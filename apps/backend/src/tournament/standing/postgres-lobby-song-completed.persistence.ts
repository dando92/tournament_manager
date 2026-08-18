import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  EventEnvelope,
  SyncStartSongCompletedPayload,
} from '../../contracts/events';
import {
  Match,
  Participant,
  Score,
  Song,
  Standing,
} from '@persistence/entities';

export interface LobbySongCompletedEffect {
  processed: boolean;
  matchIds: number[];
  warnings: string[];
}

type RecalculateStandings = (
  scoringSystem: string,
  standings: Standing[],
) => void;

@Injectable()
export class PostgresLobbySongCompletedPersistence {
  static readonly consumerIdentity = 'syncstart-song-completed';

  constructor(private readonly dataSource: DataSource) {}

  processOnce(
    event: EventEnvelope<SyncStartSongCompletedPayload>,
    recalculate: RecalculateStandings,
  ): Promise<LobbySongCompletedEffect> {
    return this.dataSource.transaction(async (manager) => {
      const inserted: Array<{ event_id: string }> = await manager.query(
        `INSERT INTO event_inbox (consumer, event_id, aggregate_id)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING
         RETURNING event_id`,
        [
          PostgresLobbySongCompletedPersistence.consumerIdentity,
          event.id,
          event.aggregateId,
        ],
      );
      if (inserted.length === 0) {
        return { processed: false, matchIds: [], warnings: [] };
      }

      const matchIds = new Set<number>();
      const warnings: string[] = [];
      for (const completedScore of event.payload.scores) {
        if (completedScore.exScore == null) {
          warnings.push(
            `No EX score found for ${completedScore.playerName} on "${event.payload.song.songPath}". Score was not saved.`,
          );
          continue;
        }
        const result = await this.persistScore(
          manager,
          event.payload,
          completedScore,
          recalculate,
        );
        if (result.warning) warnings.push(result.warning);
        if (result.matchId) matchIds.add(result.matchId);
      }
      return { processed: true, matchIds: [...matchIds], warnings };
    });
  }

  private async persistScore(
    manager: EntityManager,
    payload: SyncStartSongCompletedPayload,
    completedScore: SyncStartSongCompletedPayload['scores'][number],
    recalculate: RecalculateStandings,
  ): Promise<{ matchId?: number; warning?: string }> {
    const normalizedName = completedScore.playerName.trim().toLowerCase();
    const participant = await manager
      .getRepository(Participant)
      .createQueryBuilder('participant')
      .leftJoinAndSelect('participant.player', 'player')
      .where('participant.tournamentId = :tournamentId', {
        tournamentId: payload.tournamentId,
      })
      .andWhere('LOWER(TRIM(player.playerName)) = :normalizedName', {
        normalizedName,
      })
      .getOne();
    const song = await manager.getRepository(Song).findOne({
      where: {
        title: payload.song.songPath,
        tournament: { id: payload.tournamentId },
      },
    });
    if (!participant?.player || !song) {
      return {
        warning: `No database player-song found for ${completedScore.playerName} on "${payload.song.songPath}". Score was not saved.`,
      };
    }

    const matches = await this.findActiveMatches(manager, payload.tournamentId);
    const candidates = matches.filter(
      (match) =>
        match.rounds?.some((round) => round.song?.id === song.id) &&
        this.getSinglesPlayerIds(match).includes(participant.player.id),
    );
    const target = candidates.find((match) => {
      const round = match.rounds.find((candidate) => candidate.song.id === song.id);
      return !round?.standings?.some(
        (standing) =>
          standing.score.player.id === participant.player.id &&
          standing.score.song.id === song.id,
      );
    });

    const score = manager.getRepository(Score).create({
      player: participant.player,
      song,
      percentage: completedScore.exScore,
      isFailed: completedScore.isFailed,
    });
    await manager.getRepository(Score).save(score);
    if (!target) return {};

    const round = target.rounds.find((candidate) => candidate.song.id === song.id);
    if (!round) {
      return {
        warning: `Unable to resolve score target for ${completedScore.playerName} on "${payload.song.songPath}". Score was not saved.`,
      };
    }
    const standing = manager.getRepository(Standing).create({
      round,
      score,
      points: 0,
    });
    await manager.getRepository(Standing).save(standing);
    round.standings.push(standing);

    const playerIds = this.getSinglesPlayerIds(target);
    const complete = playerIds.every((playerId) =>
      round.standings.some((candidate) => candidate.score.player.id === playerId),
    );
    if (complete) {
      recalculate(target.scoringSystem, round.standings);
      await manager.getRepository(Standing).save(round.standings);
    }
    return { matchId: target.id };
  }

  private findActiveMatches(
    manager: EntityManager,
    tournamentId: number,
  ): Promise<Match[]> {
    return manager.getRepository(Match).find({
      where: {
        active: true,
        phaseGroup: { phase: { division: { tournament: { id: tournamentId } } } },
      },
      relations: {
        entrants: { participants: { player: true } },
        rounds: { song: true, standings: { score: { player: true, song: true } } },
      },
    });
  }

  private getSinglesPlayerIds(match: Match): number[] {
    return (match.entrants ?? [])
      .filter((entrant) => entrant.type === 'player')
      .map((entrant) => entrant.participants?.[0]?.player?.id)
      .filter((id): id is number => Number.isFinite(id));
  }
}
