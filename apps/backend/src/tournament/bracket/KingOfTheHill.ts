import { IBracketSystem } from "@bracket/IBracketSystem";
import { Division, Entrant, Phase } from "@persistence/entities";

export class KingOfTheHill extends IBracketSystem {
    getName(): string {
        return "KingOfTheHill";
    }

    getDescription(): string {
        return "KingOfTheHill";
    }

    protected async createBracket(_entrants: Entrant[], _playerPerMatch: number, _division: Division, _phase: Phase): Promise<void> {
        // KingOfTheHill bracket — not yet implemented
    }
}
