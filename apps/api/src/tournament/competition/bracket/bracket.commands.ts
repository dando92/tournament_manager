import { Inject, Injectable } from "@nestjs/common";
import { Manual } from "@bracket/systems/manual";
import { DoubleElimination } from "@bracket/systems/double-elimination";
import { SingleElimination } from "@bracket/systems/single-elimination";
import { BracketSystem } from "@bracket/systems/bracket-system";
import { KingOfTheHill } from "@bracket/systems/king-of-the-hill";
import { MatchCommands } from "@match/match.commands";
import { AdvancementRuleStore } from "@tournament/structure/advancement/advancement-rule.store";
import { PhaseGroupCommands } from "@tournament/structure/phase-group/phase-group.commands";

@Injectable()
export class BracketCommands {
    private readonly systems: Map<string, BracketSystem>;
    constructor(
        @Inject()
        private readonly matchCommands: MatchCommands,
        @Inject()
        private readonly advancementRules: AdvancementRuleStore,
        @Inject()
        private readonly phaseGroupCommands: PhaseGroupCommands,
    ) {
        const args: [MatchCommands, AdvancementRuleStore, PhaseGroupCommands] =
            [matchCommands, advancementRules, phaseGroupCommands];

        const all: BracketSystem[] = [
            new DoubleElimination(...args),
            new SingleElimination(...args),
            new KingOfTheHill(...args),
            new Manual(...args),
        ];
        this.systems = new Map(all.map(s => [s.getName(), s]));
    }

    getBracketSystem(name: string): BracketSystem {
        return this.systems.get(name);
    }

    getAll(): string[] {
        return Array.from(this.systems.keys());
    }
}
