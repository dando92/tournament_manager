import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entrant, Match, PhaseGroup } from '@tournament-manager/persistence';
import { CreateMatchDto, UpdateMatchDto } from '@match/dtos/match.dto';
import { UiUpdatePublisher } from '@match/services/ui-update.publisher';
import { AdvancementRuleService } from '@tournament/structure/services/advancement-rule.service';
import { PhaseGroupService } from '@tournament/structure/services/phase-group.service';

@Injectable()
export class MatchService {
    constructor(
        @InjectRepository(Match)
        private readonly matchRepository: Repository<Match>,
        @InjectRepository(PhaseGroup)
        private readonly phaseGroupRepository: Repository<PhaseGroup>,
        @InjectRepository(Entrant)
        private readonly entrantRepository: Repository<Entrant>,
        private readonly uiUpdateGateway: UiUpdatePublisher,
        private readonly advancementRuleService: AdvancementRuleService,
        private readonly phaseGroupService: PhaseGroupService,
    ) {}

    async create(dto: CreateMatchDto): Promise<Match> {
        const match = new Match();

        const phaseGroup = await this.phaseGroupRepository.findOne({
            where: { id: dto.phaseGroupId },
            relations: { phase: true },
        });
        if (!phaseGroup) throw new NotFoundException(`PhaseGroup with ID ${dto.phaseGroupId} not found`);
        match.phaseGroup = phaseGroup;

        match.entrants = [];

        if (dto.entrantIds !== undefined) {
            for (const entrantId of dto.entrantIds) {
                const entrant = await this.entrantRepository.findOne({
                    where: { id: entrantId },
                    relations: { participants: { player: true } },
                });
                if (!entrant) throw new NotFoundException(`Entrant with ID ${entrantId} not found`);
                match.entrants.push(entrant);
            }
        }

        match.scoringSystem = dto.scoringSystem;
        match.active = false;
        match.name = dto.name;
        if (dto.notes) {
            match.notes = dto.notes;
        }
        match.subtitle = dto.subtitle;

        const savedMatch = await this.matchRepository.save(match);
        await this.phaseGroupService.syncDerivedEntrants(phaseGroup.id);
        await this.uiUpdateGateway.emitPhaseGroupUpdateByPhaseGroupId(phaseGroup.id);

        return savedMatch;
    }

    async getMatch(id: number): Promise<Match | null> {
        return await this.findOneForView(id);
    }

    async findActiveByTournamentForLobbyLookup(tournamentId: number): Promise<Match[]> {
        return await this.matchRepository.find({
            where: {
                active: true,
                phaseGroup: {
                    phase: {
                    division: {
                        tournament: {
                            id: tournamentId,
                        },
                    },
                    },
                },
            },
            relations: {
                entrants: { participants: { player: true } },
                rounds: {
                    song: true,
                    standings: {
                        player: true,
                        score: {
                            player: true,
                            song: true,
                        },
                    },
                },
                matchResult: true,
            },
        });
    }

    /**
     * How many matches in each pool of a tournament are waiting on a person.
     *
     * A match is waiting when it has players, has rounds, has no committed
     * result, and every one of its rounds is settled. A round played on a song
     * is settled when every player has a standing in it; a hand-scored round is
     * settled as soon as somebody has been given a point, because one to
     * nothing is a result and nobody owes a zero.
     *
     * That is the same rule the match card draws as "Ready to commit"
     * (`getMatchProgress` in the frontend) and the one the commit enforces
     * (`buildMatchResultPlayerPoints`); the three must be changed together.
     *
     * It is one aggregate rather than a load of the tournament's matches
     * because the caller is the sidebar tree, which needs a count per pool and
     * nothing else. Written as SQL because the row-count comparison it does is
     * the whole query, and a TypeORM equivalent would only hide it.
     */
    async countPendingByPhaseGroup(tournamentId: number): Promise<Map<number, number>> {
        const rows: Array<{ phaseGroupId: number; pendingMatchCount: number }> = await this.matchRepository.query(
            `
            WITH tournament_match AS (
                SELECT m."id", m."phaseGroupId"
                FROM "match" m
                JOIN "phase_group" pg ON pg."id" = m."phaseGroupId"
                JOIN "phase" p ON p."id" = pg."phaseId"
                JOIN "division" d ON d."id" = p."divisionId"
                WHERE d."tournamentId" = $1 AND m."matchResultId" IS NULL
            ),
            match_player AS (
                SELECT DISTINCT tm."id" AS "matchId", pa."playerId"
                FROM tournament_match tm
                JOIN "match_entrants_entrant" me ON me."matchId" = tm."id"
                JOIN "entrant" e ON e."id" = me."entrantId" AND e."type" = 'player'
                JOIN "entrant_participants_participant" ep ON ep."entrantId" = e."id"
                JOIN "participant" pa ON pa."id" = ep."participantId"
            ),
            player_count AS (
                SELECT "matchId", COUNT(*) AS "players"
                FROM match_player
                GROUP BY "matchId"
            ),
            match_round AS (
                SELECT r."matchId", r."id" AS "roundId", r."songId" IS NOT NULL AS "played"
                FROM "round" r
                JOIN tournament_match tm ON tm."id" = r."matchId"
            ),
            round_fill AS (
                SELECT
                    mr."matchId",
                    mr."roundId",
                    mr."played",
                    COUNT(DISTINCT s."playerId") AS "entered",
                    COUNT(*) FILTER (WHERE s."points" > 0) AS "stated"
                FROM match_round mr
                LEFT JOIN "standing" s
                    ON s."roundId" = mr."roundId"
                    AND EXISTS (
                        SELECT 1 FROM match_player mp
                        WHERE mp."matchId" = mr."matchId" AND mp."playerId" = s."playerId"
                    )
                GROUP BY mr."matchId", mr."roundId", mr."played"
            ),
            unsettled_round AS (
                SELECT DISTINCT rf."matchId"
                FROM round_fill rf
                JOIN player_count pc ON pc."matchId" = rf."matchId"
                WHERE (rf."played" AND rf."entered" < pc."players")
                   OR (NOT rf."played" AND rf."stated" = 0)
            )
            SELECT tm."phaseGroupId" AS "phaseGroupId", COUNT(*)::int AS "pendingMatchCount"
            FROM tournament_match tm
            JOIN player_count pc ON pc."matchId" = tm."id"
            WHERE EXISTS (SELECT 1 FROM match_round mr WHERE mr."matchId" = tm."id")
              AND NOT EXISTS (SELECT 1 FROM unsettled_round ur WHERE ur."matchId" = tm."id")
            GROUP BY tm."phaseGroupId"
            `,
            [tournamentId],
        );

        return new Map(rows.map((row) => [Number(row.phaseGroupId), Number(row.pendingMatchCount)]));
    }

    async findByDivisionForView(divisionId: number): Promise<Match[]> {
        return this.matchRepository.find({
            where: {
                phaseGroup: {
                    phase: {
                    division: {
                        id: divisionId,
                    },
                    },
                },
            },
            relations: {
                phaseGroup: { phase: true },
                entrants: { participants: { player: true } },
                rounds: {
                    song: true,
                    standings: {
                        player: true,
                        score: {
                            player: true,
                        },
                    },
                },
                matchResult: true,
            },
        });
    }

    async findByPhaseGroupForView(phaseGroupId: number): Promise<Match[]> {
        return this.matchRepository.find({
            where: {
                phaseGroup: {
                    id: phaseGroupId,
                },
            },
            relations: {
                phaseGroup: { phase: true },
                entrants: { participants: { player: true } },
                rounds: {
                    song: true,
                    standings: {
                        player: true,
                        score: {
                            player: true,
                        },
                    },
                },
                matchResult: true,
            },
        });
    }

    async findOneForView(id: number): Promise<Match | null> {
        return await this.matchRepository.findOne({
            where: { id },
            relations: {
                entrants: { participants: { player: true } },
                phaseGroup: { phase: true },
                rounds: {
                    song: true,
                    standings: {
                        player: true,
                        score: {
                            player: true,
                            song: true,
                        },
                    },
                    matchAssignments: true,
                },
                matchResult: true,
            },
        });
    }

    async findOneBasic(id: number): Promise<Match | null> {
        return await this.matchRepository.findOneBy({ id });
    }

    async update(id: number, dto: UpdateMatchDto): Promise<Match> {
        const match = await this.findOneBasic(id);
        if (!match) throw new Error(`Match with ID ${id} not found`);

        const affectedPhaseGroupIds = new Set<number>();
        const currentPhaseGroupId = await this.findPhaseGroupIdForMatch(id);
        if (currentPhaseGroupId) affectedPhaseGroupIds.add(currentPhaseGroupId);
        const membershipChanged = dto.entrantIds !== undefined || dto.phaseGroupId !== undefined;

        if (dto.phaseGroupId !== undefined) {
            affectedPhaseGroupIds.add(dto.phaseGroupId);
            const phaseGroup = await this.phaseGroupRepository.findOne({
                where: { id: dto.phaseGroupId },
                relations: { phase: true },
            });
            if (!phaseGroup) throw new NotFoundException(`PhaseGroup with ID ${dto.phaseGroupId} not found`);
            match.phaseGroup = phaseGroup;
            delete dto.phaseGroupId;
        }

        if (dto.entrantIds !== undefined) {
            const entrants = [];
            for (const entrantId of dto.entrantIds) {
                const entrant = await this.entrantRepository.findOne({
                    where: { id: entrantId },
                    relations: { participants: { player: true } },
                });
                if (!entrant) throw new NotFoundException(`Entrant with ID ${entrantId} not found`);
                entrants.push(entrant);
            }
            match.entrants = entrants;
            delete dto.entrantIds;
        }

        this.matchRepository.merge(match, dto);
        const updatedMatch = await this.matchRepository.save(match);
        if (membershipChanged) {
            for (const phaseGroupId of affectedPhaseGroupIds) {
                await this.phaseGroupService.syncDerivedEntrants(phaseGroupId);
            }
        }
        await this.uiUpdateGateway.emitMatchUpdateByMatchId(updatedMatch.id);
        return updatedMatch;
    }

    async updateActive(id: number, active: boolean): Promise<Match> {
        const match = await this.findOneBasic(id);
        if (!match) throw new Error(`Match with ID ${id} not found`);

        match.active = active;
        const updatedMatch = await this.matchRepository.save(match);
        await this.uiUpdateGateway.emitMatchUpdateByMatchId(updatedMatch.id);
        return updatedMatch;
    }

    async delete(id: number): Promise<void> {
        const match = await this.findOneBasic(id);
        if (!match) return;
        const loaded = await this.matchRepository.findOne({
            where: { id },
            relations: { phaseGroup: { phase: true } },
        });
        const phaseGroupId = loaded?.phaseGroup?.id;

        await this.advancementRuleService.deleteInvolvingMatch(id);

        await this.matchRepository.remove(match);
        if (phaseGroupId) await this.phaseGroupService.syncDerivedEntrants(phaseGroupId);
        await this.uiUpdateGateway.emitPhaseGroupUpdateByPhaseGroupId(phaseGroupId);
    }

    private async findPhaseGroupIdForMatch(id: number): Promise<number | undefined> {
        const match = await this.matchRepository.findOne({
            where: { id },
            relations: { phaseGroup: true },
        });
        return match?.phaseGroup?.id;
    }
}
