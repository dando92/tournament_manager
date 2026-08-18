import { IBracketSystem } from "@bracket/IBracketSystem";
import { Division, Entrant, Phase } from "@persistence/entities";

export class Manual extends IBracketSystem {
    getName(): string {
        return "First phase only";
    }

    getDescription(): string {
        return "First phase only";
    }

    protected async createBracket(_entrants: Entrant[], _playerPerMatch: number, _division: Division, _phase: Phase, phaseGroupId: number): Promise<void> {
        const matchCount = Math.ceil(_entrants.length / _playerPerMatch);
        const matches = await this.CreateMatchesInPhase("Match", _phase, matchCount, phaseGroupId);
        await this.fillFirstWave(_entrants, matches, _playerPerMatch);
    }
}
