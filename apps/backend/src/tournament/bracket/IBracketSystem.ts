import { Inject } from "@nestjs/common";
import { CreateMatchDto } from "@tournament/dtos";

import { Entrant, Match, Division, Phase, PhaseGroup } from "@persistence/entities";
import { DivisionService } from "@tournament/services/division.service";
import { MatchManager } from "@match/services/match.manager";
import { MatchService } from "@match/services/match.service";
import { PhaseService } from "@tournament/services/phase.service";
import { AdvancementRuleService } from "@tournament/services/advancement-rule.service";
import { PhaseGroupService } from "@tournament/services/phase-group.service";

export class IBracketSystem {
    constructor(
        @Inject()
        protected readonly matchService: MatchService,
        @Inject()
        protected readonly matchManager: MatchManager,
        @Inject()
        protected readonly divisionService: DivisionService,
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

    async generateForExistingPhaseGroup(
        division: Division,
        phase: Phase,
        phaseGroup: PhaseGroup,
        entrants: Entrant[],
        playerPerMatch: number = 2,
    ): Promise<void> {
        await this.phaseGroupService.replaceEntrants(phaseGroup.id, entrants);
        await this.createBracket(entrants, playerPerMatch, division, phase, phaseGroup.id);
    }

    protected async createBracket(
        _entrants: Entrant[],
        _playerPerMatch: number,
        _division: Division,
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

    protected async fillFirstWave(entrants: Entrant[], firstRound: Match[], playerPerMatch: number): Promise<void> {
        for (let i = 0; i < entrants.length; i++) {
            const matchIndex = Math.floor(i / playerPerMatch);
            if (matchIndex < firstRound.length) {
                await this.AddEntrantToMatch(entrants[i], firstRound[matchIndex].id);
            }
        }
    }

    protected async CreateMatchesInPhase(namePrefix: string, _phase: Phase, matchCount: number, phaseGroupId: number): Promise<Match[]> {
        const matches: Match[] = [];
        for (let i = 0; i < matchCount; i++) {
            const match = await this.CreateEmptyMatch(namePrefix + "_Match_" + i, "MatchDescription", phaseGroupId);
            matches.push(match);
        }
        return matches;
    }

    protected async CreateMatchAdvancementRule(
        sourceMatch: Match,
        sourcePlacementIndex: number,
        targetMatch: Match,
        targetSlotIndex: number,
    ): Promise<void> {
        await this.advancementRuleService.createMatchToMatchRule(
            sourceMatch.id,
            sourcePlacementIndex + 1,
            targetMatch.id,
            targetSlotIndex + 1,
        );
    }

    protected async CreateEmptyMatch(name: string, desc: string, phaseGroupId: number): Promise<Match> {
        const dto = new CreateMatchDto();

        dto.phaseGroupId = phaseGroupId;
        dto.name = name;
        dto.notes = desc;
        dto.scoringSystem = "EurocupScoreCalculator";

        return await this.matchService.create(dto);
    }

    protected async AddEntrantToMatch(entrant: Entrant, matchId: number) {
        return await this.matchManager.AddEntrantInMatch(matchId, entrant.id);
    }

    protected async RemoveEntrantFromMatch(entrant: Entrant, matchId: number) {
        await this.matchManager.RemoveEntrantInMatch(matchId, entrant.id);
    }
}
