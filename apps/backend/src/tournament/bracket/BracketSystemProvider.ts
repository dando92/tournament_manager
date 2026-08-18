import { Inject, Injectable } from "@nestjs/common";
import { Manual } from "@bracket/Manual";
import { DoubleElimination } from "@bracket/DoubleElimination";
import { SingleElimination } from "@bracket/SingleElimination";
import { IBracketSystem } from "@bracket/IBracketSystem";
import { KingOfTheHill } from "@bracket/KingOfTheHill";
import { MatchService } from "@match/services/match.service";
import { DivisionService } from "@tournament/services/division.service";
import { MatchManager } from "@match/services/match.manager";
import { PhaseService } from "@tournament/services/phase.service";
import { AdvancementRuleService } from "@tournament/services/advancement-rule.service";
import { PhaseGroupService } from "@tournament/services/phase-group.service";

@Injectable()
export class BracketSystemProvider {
    private readonly systems: Map<string, IBracketSystem>;
    constructor(
        @Inject()
        private readonly matchService: MatchService,
        @Inject()
        private readonly matchManager: MatchManager,
        @Inject()
        private readonly divisionService: DivisionService,
        @Inject()
        private readonly phaseService: PhaseService,
        @Inject()
        private readonly advancementRuleService: AdvancementRuleService,
        @Inject()
        private readonly phaseGroupService: PhaseGroupService,
    ) {
        const args: [MatchService, MatchManager, DivisionService, PhaseService, AdvancementRuleService, PhaseGroupService] =
            [matchService, matchManager, divisionService, phaseService, advancementRuleService, phaseGroupService];

        const all: IBracketSystem[] = [
            new DoubleElimination(...args),
            new SingleElimination(...args),
            new KingOfTheHill(...args),
            new Manual(...args),
        ];
        this.systems = new Map(all.map(s => [s.getName(), s]));
    }

    getBracketSystem(name: string): IBracketSystem {
        return this.systems.get(name);
    }

    getAll(): string[] {
        return Array.from(this.systems.keys());
    }
}
