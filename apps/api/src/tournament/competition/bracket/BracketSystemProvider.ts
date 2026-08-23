import { Inject, Injectable } from "@nestjs/common";
import { Manual } from "@bracket/Manual";
import { DoubleElimination } from "@bracket/DoubleElimination";
import { SingleElimination } from "@bracket/SingleElimination";
import { IBracketSystem } from "@bracket/IBracketSystem";
import { KingOfTheHill } from "@bracket/KingOfTheHill";
import { MatchCommands } from "@match/match.commands";
import { PhaseService } from "@tournament/structure/services/phase.service";
import { AdvancementRuleService } from "@tournament/structure/services/advancement-rule.service";
import { PhaseGroupService } from "@tournament/structure/phase-group/phase-group.service";

@Injectable()
export class BracketSystemProvider {
    private readonly systems: Map<string, IBracketSystem>;
    constructor(
        @Inject()
        private readonly matchCommands: MatchCommands,
        @Inject()
        private readonly phaseService: PhaseService,
        @Inject()
        private readonly advancementRuleService: AdvancementRuleService,
        @Inject()
        private readonly phaseGroupService: PhaseGroupService,
    ) {
        const args: [MatchCommands, PhaseService, AdvancementRuleService, PhaseGroupService] =
            [matchCommands, phaseService, advancementRuleService, phaseGroupService];

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
