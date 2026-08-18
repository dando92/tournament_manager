import { Inject, Injectable } from "@nestjs/common";
import { CreateMatchAssignmentDto } from '../../tournament/dtos';
import { Match, MatchAssignment, Setup } from '@persistence/entities';


@Injectable()
export class PadRoller {
    constructor() { }

    async AutoRollPads(match: Match) {
        const rounds = match.rounds;
        const players = (match.entrants ?? [])
            .filter((entrant) => entrant.type === 'player')
            .map((entrant) => entrant.participants?.[0]?.player)
            .filter(Boolean);
        const setups: Setup[] = null;

        setups.sort((a, b) => a.position - b.position);

        for (let i = 0; i < rounds.length; i++) {
            const matchAssignment = new CreateMatchAssignmentDto();
            const matchAssignments: MatchAssignment[] = [];

            for (let j = 0; j < players.length; j++) {
                matchAssignment.playerId = players[j].id;
                matchAssignment.setupId = setups[j].id;
                matchAssignment.roundId = rounds[i].id;
                //todo: CREATE MATCH ASSIGNMENT
                //matchAssignments.push(await this.createMatchAssignmentUseCase.execute(matchAssignment));
            }

            setups.push(setups.shift());

            match.rounds[i].matchAssignments = matchAssignments;
        }

        return match;
    }
}
