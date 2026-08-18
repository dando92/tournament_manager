import { Injectable, NotFoundException } from '@nestjs/common';
import { DivisionStandingRowDto, DivisionSummaryDto } from '../dtos';
import { DivisionService } from './division.service';
import { AdvancementRuleService } from './advancement-rule.service';

@Injectable()
export class DivisionManager {
    constructor(
        private readonly divisionService: DivisionService,
        private readonly advancementRuleService: AdvancementRuleService,
    ) {}

    async findSummary(id: number): Promise<DivisionSummaryDto> {
        const division = await this.divisionService.findOneForSummary(id);
        if (!division) throw new NotFoundException(`Division ${id} not found`);

        const phaseGroupIds = (division.phases ?? []).flatMap((phase) => (phase.phaseGroups ?? []).map((phaseGroup) => phaseGroup.id));
        const phaseGroupRules = await this.advancementRuleService.findBySources('phase_group', phaseGroupIds);

        return {
            id: division.id,
            name: division.name,
            entrants: (division.entrants ?? []).map((entrant) => ({
                id: entrant.id,
                name: entrant.name,
                type: entrant.type,
                status: entrant.status,
                participants: (entrant.participants ?? []).map((participant) => ({
                    id: participant.id,
                    roles: participant.roles ?? [],
                    status: participant.status,
                    player: {
                        id: participant.player.id,
                        playerName: participant.player.playerName,
                    },
                })),
            })),
            phases: (division.phases ?? []).map((phase) => ({
                id: phase.id,
                name: phase.name,
                matchCount: (phase.phaseGroups ?? []).reduce((count, phaseGroup) => count + (phaseGroup.matches?.length ?? 0), 0),
                phaseGroups: (phase.phaseGroups ?? []).map((phaseGroup) => ({
                    id: phaseGroup.id,
                    name: phaseGroup.name,
                    displayIdentifier: phaseGroup.displayIdentifier ?? null,
                    bracketType: phaseGroup.bracketType ?? null,
                    state: phaseGroup.state,
                    matchCount: phaseGroup.matches?.length ?? 0,
                    entrants: [],
                    advancementRules: phaseGroupRules
                        .filter((rule) => rule.sourceKind === 'phase_group' && rule.sourceId === phaseGroup.id)
                        .map((rule) => ({
                            id: rule.id,
                            sourceKind: rule.sourceKind,
                            sourceId: rule.sourceId,
                            sourcePlacement: rule.sourcePlacement,
                            targetKind: rule.targetKind,
                            targetId: rule.targetId,
                            targetSlot: rule.targetSlot,
                        })),
                })),
            })),
        };
    }

    async findStandings(id: number): Promise<DivisionStandingRowDto[]> {
        const division = await this.divisionService.findOneForStandings(id);
        if (!division) throw new NotFoundException(`Division ${id} not found`);

        const playerTotals = new Map<number, DivisionStandingRowDto>();

        for (const phase of division.phases ?? []) {
            for (const phaseGroup of phase.phaseGroups ?? []) {
            for (const match of phaseGroup.matches ?? []) {
                for (const round of match.rounds ?? []) {
                    for (const standing of round.standings ?? []) {
                        const player = standing.score.player;
                        const current = playerTotals.get(player.id) ?? {
                            id: player.id,
                            playerName: player.playerName,
                            points: 0,
                            songsPlayed: 0,
                        };

                        current.points += standing.points ?? 0;
                        current.songsPlayed += 1;
                        playerTotals.set(player.id, current);
                    }
                }
            }
            }
        }

        return Array.from(playerTotals.values()).sort((a, b) =>
            b.points - a.points || b.songsPlayed - a.songsPlayed || a.playerName.localeCompare(b.playerName),
        );
    }
}
