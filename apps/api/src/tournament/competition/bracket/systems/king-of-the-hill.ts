import { BracketSystem } from "@bracket/systems/bracket-system";
import { Entrant, Phase } from "@tournament-manager/persistence";

export class KingOfTheHill extends BracketSystem {
    getName(): string {
        return "KingOfTheHill";
    }

    getDescription(): string {
        return "KingOfTheHill";
    }

    protected async createBracket(_entrants: Entrant[], _playerPerMatch: number, _phase: Phase): Promise<void> {
        // KingOfTheHill bracket — not yet implemented
    }
}
