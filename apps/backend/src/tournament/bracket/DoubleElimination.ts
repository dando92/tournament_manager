import { IBracketSystem } from "@bracket/IBracketSystem";
import { Division, Entrant, Match, Phase } from "@persistence/entities";

export class DoubleElimination extends IBracketSystem {
    getName(): string {
        return "DoubleElimination";
    }

    getDescription(): string {
        return "DoubleElimination";
    }

    protected async createBracket(entrants: Entrant[], playerPerMatch: number, _division: Division, phase: Phase, phaseGroupId?: number): Promise<void> {
        if (playerPerMatch !== 2 && playerPerMatch !== 4 && playerPerMatch !== 8) {
            throw new Error(`DoubleElimination only supports playerPerMatch of 2, 4, or 8, got ${playerPerMatch}`);
        }

        const firstRound = await this.buildStructure(entrants.length, playerPerMatch, phase, phaseGroupId);
        await this.fillFirstWave(entrants, firstRound, playerPerMatch);
    }

    private async buildStructure(playerCount: number, playerPerMatch: number, phase: Phase, phaseGroupId?: number): Promise<Match[]> {
        const passingPlayers = playerPerMatch / 2;
        const r1MatchCount = Math.max(2, this.nextPow2(Math.ceil(playerCount / playerPerMatch)));
        const nextEffN = playerPerMatch * r1MatchCount;
        const byes = nextEffN - playerCount;

        if (byes > 0) {
            console.log(`DoubleElimination: adding ${byes} bye(s) (effective bracket size: ${nextEffN})`);
        }

        const wbRoundCount = Math.log2(r1MatchCount) + 1;

        // --- Create Winners Bracket rounds ---
        const wbRounds: Match[][] = [];
        let wbMatchCount = r1MatchCount;
        for (let k = 0; k < wbRoundCount; k++) {
            const matches = await this.CreateMatchesInPhase(`WB_Round_${k + 1}`, phase, wbMatchCount, phaseGroupId);
            wbRounds.push(matches);
            wbMatchCount = Math.floor(wbMatchCount / 2);
        }

        // --- Create Losers Bracket rounds ---
        const lbRounds: Match[][] = [];
        let lbMatchCount = Math.floor(r1MatchCount / 2);
        for (let i = 0; i < 2 * (wbRoundCount - 1); i++) {
            const isDropRound = i % 2 === 1;
            const roundNum = Math.floor(i / 2) + 1;
            const roundName = isDropRound ? `LB_Drop_${roundNum}` : `LB_Merge_${roundNum}`;
            const matches = await this.CreateMatchesInPhase(roundName, phase, lbMatchCount, phaseGroupId);
            lbRounds.push(matches);
            if (isDropRound) {
                lbMatchCount = Math.floor(lbMatchCount / 2);
            }
        }

        // --- Create Grand Final ---
        const grandFinalMatches = await this.CreateMatchesInPhase('Grand_Final', phase, 1, phaseGroupId);
        const grandFinalMatch = grandFinalMatches[0];

        // --- Wire Winners Bracket advancement rules ---
        for (let k = 0; k < wbRoundCount; k++) {
            const round = wbRounds[k];
            for (let m = 0; m < round.length; m++) {
                const match = round[m];
                // Top placements stay in winners, lower placements drop to losers.
                const winnerDest = k < wbRoundCount - 1
                    ? wbRounds[k + 1][Math.floor(m / 2)]
                    : grandFinalMatch;

                const loserDest = k === 0
                    ? lbRounds[0][Math.floor(m / 2)]
                    : lbRounds[2 * k - 1][m];

                const winnerBaseSlot = (m % 2) * passingPlayers;
                const firstLoserRoundBaseSlot = (m % 2) * passingPlayers;
                const dropLoserBaseSlot = passingPlayers;

                for (let p = 0; p < passingPlayers; p++) {
                    await this.CreateMatchAdvancementRule(match, p, winnerDest, winnerBaseSlot + p);
                    await this.CreateMatchAdvancementRule(
                        match,
                        passingPlayers + p,
                        loserDest,
                        (k === 0 ? firstLoserRoundBaseSlot : dropLoserBaseSlot) + p,
                    );
                }
            }
        }

        // --- Wire Losers Bracket advancement rules ---
        for (let i = 0; i < lbRounds.length; i++) {
            const round = lbRounds[i];
            const isLast = i === lbRounds.length - 1;

            for (let m = 0; m < round.length; m++) {
                const match = round[m];
                // Top placements continue through losers, lower placements are eliminated.
                let winnerDest: Match;
                if (isLast) {
                    winnerDest = grandFinalMatch;
                } else if (i % 2 === 0) {
                    winnerDest = lbRounds[i + 1][m];
                } else {
                    winnerDest = lbRounds[i + 1][Math.floor(m / 2)];
                }

                const targetBaseSlot = isLast
                    ? passingPlayers
                    : i % 2 === 0
                        ? 0
                        : (m % 2) * passingPlayers;

                for (let p = 0; p < passingPlayers; p++) {
                    await this.CreateMatchAdvancementRule(match, p, winnerDest, targetBaseSlot + p);
                }
            }
        }

        return wbRounds[0];
    }
}
