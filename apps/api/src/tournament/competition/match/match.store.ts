import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsRelations, In, QueryFailedError, Repository } from 'typeorm';
import {
    Entrant,
    Match,
    MatchResult,
    PhaseGroup,
    Player,
    Round,
    Score,
    Song,
    Standing,
} from '@tournament-manager/persistence';

import { MatchAggregate } from '@match/match.aggregate';

/**
 * The one definition of what a match is when it is about to change.
 *
 * It reaches the tournament because every write publishes an event addressed by
 * it, and a graph that stops at the pool would make each write ask the database
 * where the match it just changed lives.
 */
const MATCH_GRAPH: FindOptionsRelations<Match> = {
    entrants: { participants: { player: true } },
    phaseGroup: { phase: { division: { tournament: true } } },
    rounds: {
        song: true,
        standings: {
            player: true,
            score: { player: true, song: true },
        },
    },
    matchResult: true,
};

/**
 * Loading and saving the match aggregate.
 *
 * A command loads once, changes the graph in memory and saves once. The save is
 * one transaction: the rows the aggregate dropped are deleted, the scores it
 * created are written before the standings that point at them, and the graph
 * itself goes back through the cascades the entities already declare.
 */
@Injectable()
export class MatchStore {
    constructor(
        @InjectDataSource()
        private readonly dataSource: DataSource,
        @InjectRepository(Match)
        private readonly matches: Repository<Match>,
        @InjectRepository(Round)
        private readonly rounds: Repository<Round>,
        @InjectRepository(Entrant)
        private readonly entrants: Repository<Entrant>,
        @InjectRepository(PhaseGroup)
        private readonly phaseGroups: Repository<PhaseGroup>,
        @InjectRepository(Player)
        private readonly players: Repository<Player>,
        @InjectRepository(Song)
        private readonly songs: Repository<Song>,
        @InjectRepository(Score)
        private readonly scores: Repository<Score>,
        @InjectRepository(Standing)
        private readonly standings: Repository<Standing>,
    ) {}

    async load(id: number): Promise<MatchAggregate | null> {
        const match = await this.matches.findOne({ where: { id }, relations: MATCH_GRAPH });

        return match ? MatchAggregate.of(match) : null;
    }

    async loadOrFail(id: number): Promise<MatchAggregate> {
        const match = await this.load(id);
        if (!match) throw new NotFoundException(`Match with id ${id} not found`);

        return match;
    }

    /** Which match a round belongs to. The round routes are addressed by round. */
    async locateRound(roundId: number): Promise<number> {
        const round = await this.rounds.findOne({ where: { id: roundId }, relations: { match: true } });
        if (!round?.match) throw new NotFoundException(`Round with id ${roundId} not found`);

        return round.match.id;
    }

    /** Loaded with its phase, division and tournament, so a new match has an address. */
    async loadPhaseGroup(id: number): Promise<PhaseGroup> {
        const phaseGroup = await this.phaseGroups.findOne({
            where: { id },
            relations: { phase: { division: { tournament: true } } },
        });
        if (!phaseGroup) throw new NotFoundException(`PhaseGroup with ID ${id} not found`);

        return phaseGroup;
    }

    /** One query whatever the count, answered in the order the caller asked for. */
    async loadEntrants(ids: number[]): Promise<Entrant[]> {
        if (ids.length === 0) return [];

        const found = await this.entrants.find({
            where: { id: In(ids) },
            relations: { participants: { player: true } },
        });
        const byId = new Map(found.map((entrant) => [entrant.id, entrant]));

        return ids.map((id) => {
            const entrant = byId.get(id);
            if (!entrant) throw new NotFoundException(`Entrant with ID ${id} not found`);

            return entrant;
        });
    }

    async loadPlayer(id: number): Promise<Player> {
        return (await this.loadPlayers([id])).get(id);
    }

    /** One query whatever the count: a lobby reports one run per player at once. */
    async loadPlayers(ids: number[]): Promise<Map<number, Player>> {
        if (ids.length === 0) return new Map();

        const found = await this.players.find({ where: { id: In(ids) } });
        const byId = new Map(found.map((player) => [player.id, player]));
        const missing = ids.find((id) => !byId.has(id));
        if (missing) throw new NotFoundException(`Player with id ${missing} not found`);

        return byId;
    }

    async loadSongs(ids: number[]): Promise<Song[]> {
        if (ids.length === 0) return [];

        const found = await this.songs.find({ where: { id: In(ids) } });
        const byId = new Map(found.map((song) => [song.id, song]));

        return ids.map((id) => {
            const song = byId.get(id);
            if (!song) throw new NotFoundException(`Song with id ${id} not found`);

            return song;
        });
    }

    async loadScore(id: number): Promise<Score> {
        return (await this.loadScores([id])).get(id);
    }

    async loadAssignableScore(id: number, roundId: number, playerId: number): Promise<Score> {
        const score = await this.loadScore(id);
        const assignment = await this.standings.findOne({
            where: { score: { id } },
            relations: { round: true, player: true },
        });
        if (assignment && (assignment.round.id !== roundId || assignment.player.id !== playerId)) {
            throw new ConflictException({
                code: 'SCORE_ALREADY_ASSIGNED',
                message: `Score ${id} is already assigned to another standing`,
                scoreId: id,
                standingId: assignment.id,
                roundId: assignment.round.id,
            });
        }

        return score;
    }

    async loadScores(ids: number[]): Promise<Map<number, Score>> {
        if (ids.length === 0) return new Map();

        const found = await this.scores.find({ where: { id: In(ids) }, relations: { player: true, song: true } });
        const byId = new Map(found.map((score) => [score.id, score]));
        const missing = ids.find((id) => !byId.has(id));
        if (missing) throw new NotFoundException(`Score with id ${missing} not found`);

        return byId;
    }

    async save(match: MatchAggregate): Promise<void> {
        const removals = match.removals;

        try {
            await this.dataSource.transaction(async (manager) => {
                if (removals.standingIds.length > 0) await manager.delete(Standing, removals.standingIds);
                if (removals.roundIds.length > 0) await manager.delete(Round, removals.roundIds);

                /* A standing points at its score, so the score exists first. The
                   ones already stored are left alone: a percentage is evidence and
                   is never rewritten by a standing being moved. */
                const unsavedScores = this.unsavedScoresOf(match);
                if (unsavedScores.length > 0) await manager.save(Score, unsavedScores);

                await manager.save(Match, match.entity);

                /* The match row released it above; the row itself is ours to drop. */
                if (removals.matchResultId) await manager.delete(MatchResult, removals.matchResultId);
            });
        } catch (error) {
            const constraint = error instanceof QueryFailedError
                ? (error.driverError as { constraint?: string }).constraint
                : undefined;
            if (constraint === 'REL_90f3771a995658f98fc55e07a8') {
                throw new ConflictException({
                    code: 'SCORE_ALREADY_ASSIGNED',
                    message: 'The selected score is already assigned to another standing',
                });
            }
            throw error;
        }

        match.settle();
    }

    async remove(match: MatchAggregate): Promise<void> {
        await this.matches.remove(match.entity);
    }

    private unsavedScoresOf(match: MatchAggregate): Score[] {
        return match.rounds
            .flatMap((round) => round.standings ?? [])
            .map((standing) => standing.score)
            .filter((score): score is Score => Boolean(score) && !score.id);
    }
}
