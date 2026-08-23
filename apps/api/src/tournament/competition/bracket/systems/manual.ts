import { BracketSystem } from "@bracket/systems/bracket-system";
import { Entrant, Phase } from "@tournament-manager/persistence";

export class Manual extends BracketSystem {
    getName(): string {
        return "First phase only";
    }

    getDescription(): string {
        return "First phase only";
    }

    protected async createBracket(_entrants: Entrant[], _playerPerMatch: number, _phase: Phase, phaseGroupId: number): Promise<void> {
        const matchCount = Math.ceil(_entrants.length / _playerPerMatch);
        const matches = await this.CreateMatchesInPhase("Match", _phase, matchCount, phaseGroupId);
        await this.fillFirstWave(_entrants, matches, _playerPerMatch);
    }
}
