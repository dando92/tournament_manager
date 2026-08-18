import { IBracketSystem } from "@bracket/IBracketSystem";
import { Division, Entrant, Match, Phase } from "@persistence/entities";

type PlayerInfo = {
    match: number;
    playerIndexInMatch: number;
};

export class SingleElimination extends IBracketSystem {
    getName(): string {
        return "SingleElimination";
    }

    getDescription(): string {
        return "SingleElimination";
    }

    protected async createBracket(entrants: Entrant[], playerPerMatch: number, _division: Division, phase: Phase, phaseGroupId?: number): Promise<void> {
        const firstRound = await this.buildStructure(entrants.length, playerPerMatch, phase, phaseGroupId);
        await this.fillFirstWave(entrants, firstRound, playerPerMatch);
    }

    private async buildStructure(playerCount: number, playerPerMatch: number, phase: Phase, phaseGroupId?: number): Promise<Match[]> {
        const nextEffN = playerPerMatch * this.nextPow2(Math.ceil(playerCount / playerPerMatch));
        const byes = nextEffN - playerCount;

        if (byes > 0) {
            console.log(`SingleElimination: adding ${byes} bye(s) (effective bracket size: ${nextEffN})`);
        }

        let count = nextEffN;
        let matchCount = count / playerPerMatch;
        let indexes: PlayerInfo[][] = null;
        let currentMatches: Match[] = null;
        let firstRound: Match[] = null;
        let roundIndex = 1;

        while (matchCount >= 1) {
            console.log("Creating matches: " + matchCount);
            const nextMatches = await this.CreateMatchesInPhase("Round_" + roundIndex++, phase, matchCount, phaseGroupId);

            if (firstRound === null) {
                firstRound = nextMatches;
            }

            if (currentMatches !== null) {
                for (let i = 0; i < nextMatches.length; i++) {
                    for (let j = 0; j < playerPerMatch; j++) {
                        const currentIndex = indexes[i][j];
                        const sourceMatch = currentMatches[currentIndex.match];
                        await this.CreateMatchAdvancementRule(
                            sourceMatch,
                            currentIndex.playerIndexInMatch,
                            nextMatches[i],
                            j,
                        );
                    }
                }
            }

            if (matchCount > 1) {
                indexes = this.getIndexes(count, playerPerMatch);
            }

            currentMatches = nextMatches;
            count /= 2;
            matchCount = count / playerPerMatch;
        }

        if (playerPerMatch > 2) {
            console.log("Creating finals");
            const finals = await this.CreateMatchesInPhase("Finals", phase, 2, phaseGroupId);

            // Top half of placements go to the first final, bottom half to the second.
            const passingPlayers = Math.floor(playerPerMatch / 2);
            for (let p = 0; p < passingPlayers; p++) {
                await this.CreateMatchAdvancementRule(currentMatches[0], p, finals[0], p);
            }
            for (let p = passingPlayers; p < playerPerMatch; p++) {
                await this.CreateMatchAdvancementRule(currentMatches[0], p, finals[1], p - passingPlayers);
            }
        }

        return firstRound;
    }

    private getIndexes(playerCount: number, playerPerMatch: number): PlayerInfo[][] {
        if (playerPerMatch > 2) {
            return this.leastRematchIndexes(playerCount, playerPerMatch);
        } else {
            return this.directMatchIndexes(playerCount, playerPerMatch);
        }
    }

    private leastRematchIndexes(playerCount: number, playerPerMatch: number): PlayerInfo[][] {
        console.log("Generating indexes for playerCount " + playerCount + " playerPerMatch " + playerPerMatch);
        const final: PlayerInfo[][] = [];
        const matchCount = playerCount / playerPerMatch;
        const passingPlayers = playerPerMatch / 2;

        for (let i = 0; i < matchCount / 2; i++) {
            final[i] = [];
        }

        for (let j = 0; j < passingPlayers; j++) {
            let k = j % 2 == 0 ? 0 : (matchCount / 2) - 1;
            const increment = j % 2 == 0 ? 1 : -1;
            let counter = passingPlayers;
            for (let i = 0; i < matchCount; i++) {
                final[k].push({ match: i, playerIndexInMatch: j });

                if (--counter <= 0) {
                    counter = passingPlayers;
                    k += increment;
                }
            }
        }
        return final;
    }

    private directMatchIndexes(playerCount: number, playerPerMatch: number): PlayerInfo[][] {
        console.log("Generating indexes for playerCount " + playerCount + " playerPerMatch " + playerPerMatch);
        const final: PlayerInfo[][] = [];
        const matchCount = playerCount / playerPerMatch;

        for (let i = 0; i < matchCount / 2; i++) {
            final[i] = [];
        }

        let k = 0;
        let counter = playerPerMatch;

        for (let i = 0; i < matchCount; i++) {
            final[k].push({ match: i, playerIndexInMatch: 0 });

            if (--counter <= 0) {
                counter = playerPerMatch;
                k += 1;
            }
        }

        return final;
    }
}
