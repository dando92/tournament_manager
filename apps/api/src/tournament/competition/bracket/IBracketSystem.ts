import { Inject } from "@nestjs/common";

import { Entrant, Phase, PhaseGroup } from "@tournament-manager/persistence";
import { MatchCommands } from "@match/match.commands";
import { PhaseService } from "@tournament/structure/services/phase.service";
import { AdvancementRuleService } from "@tournament/structure/services/advancement-rule.service";
import { PhaseGroupService } from "@tournament/structure/services/phase-group.service";

export class IBracketSystem {
    constructor(
        @Inject()
        protected readonly matchCommands: MatchCommands,
        @Inject()
        protected readonly phaseService: PhaseService,
        @Inject()
        protected readonly advancementRuleService: AdvancementRuleService,
        @Inject()
        protected readonly phaseGroupService: PhaseGroupService,
    ) {
    }

    getName(): string {
        throw new Error("Method 'Name' should be implemented.");
    }

    getDescription(): string {
        throw new Error("Method 'Description' should be implemented.");
    }

    /** The entrants take their slots in the order the division seeded them. */
    async generateForExistingPhaseGroup(
        phase: Phase,
        phaseGroup: PhaseGroup,
        entrants: Entrant[],
        playerPerMatch: number = 2,
    ): Promise<void> {
        await this.phaseGroupService.replaceEntrants(phaseGroup.id, entrants);
        await this.createBracket(entrants, playerPerMatch, phase, phaseGroup.id);
    }

    protected async createBracket(
        _entrants: Entrant[],
        _playerPerMatch: number,
        _phase: Phase,
        _phaseGroupId?: number,
    ): Promise<void> {
        throw new Error("Method 'createBracket' should be implemented.");
    }

    protected nextPow2(x: number): number {
        let p = 1;
        while (p < x) p *= 2;
        return p;
    }

    protected async fillFirstWave(entrants: Entrant[], firstRound: number[], playerPerMatch: number): Promise<void> {
        for (let i = 0; i < entrants.length; i++) {
            const matchIndex = Math.floor(i / playerPerMatch);
            if (matchIndex < firstRound.length) {
                await this.AddEntrantToMatch(entrants[i], firstRound[matchIndex]);
            }
        }
    }

    /** A structure is built out of match ids: nothing here reads a match back. */
    protected async CreateMatchesInPhase(namePrefix: string, _phase: Phase, matchCount: number, phaseGroupId: number): Promise<number[]> {
        const matchIds: number[] = [];
        for (let i = 0; i < matchCount; i++) {
            matchIds.push(await this.CreateEmptyMatch(namePrefix + "_Match_" + i, "MatchDescription", phaseGroupId));
        }
        return matchIds;
    }

    protected async CreateMatchAdvancementRule(
        sourceMatchId: number,
        sourcePlacementIndex: number,
        targetMatchId: number,
        targetSlotIndex: number,
    ): Promise<void> {
        await this.advancementRuleService.createMatchToMatchRule(
            sourceMatchId,
            sourcePlacementIndex + 1,
            targetMatchId,
            targetSlotIndex + 1,
        );
    }

    protected async CreateEmptyMatch(name: string, desc: string, phaseGroupId: number): Promise<number> {
        return await this.matchCommands.create({
            name,
            notes: desc,
            phaseGroupId,
            scoringSystem: "EurocupScoreCalculator",
        });
    }

    protected async AddEntrantToMatch(entrant: Entrant, matchId: number) {
        return await this.matchCommands.addEntrant(matchId, entrant.id);
    }

    protected async RemoveEntrantFromMatch(entrant: Entrant, matchId: number) {
        await this.matchCommands.removeEntrant(matchId, entrant.id);
    }
}
