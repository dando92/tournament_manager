import { Injectable, NotFoundException } from '@nestjs/common';
import { EntrantDto } from '@tournament-manager/contracts';
import { PlayerService } from '@player/player.service';
import { ParticipantService } from '@tournament/services/participant.service';
import { DivisionCommands } from '@tournament/structure/division/division.commands';
import { DivisionQueries } from '@tournament/structure/division/division.queries';

/**
 * Registering people by name.
 *
 * A player belongs to the application, a participant to a tournament and an
 * entrant to a division, so each step here creates the one below it and the
 * roster change itself is left to the division, which is the aggregate that
 * owns it and publishes what it changed.
 */
@Injectable()
export class PlayerManager {
    constructor(
        private readonly playerService: PlayerService,
        private readonly participantService: ParticipantService,
        private readonly divisionCommands: DivisionCommands,
        private readonly divisionQueries: DivisionQueries,
    ) {}

    async assignPlayerToDivision(playerId: number, divisionId: number): Promise<void> {
        const tournamentId = await this.tournamentOf(divisionId);
        const participant = await this.participantService.ensureForPlayer(tournamentId, playerId, ['competitor']);

        await this.divisionCommands.addParticipants(divisionId, [participant.id]);
    }

    async removePlayerFromDivision(playerId: number, divisionId: number): Promise<void> {
        await this.divisionCommands.removePlayer(divisionId, playerId);
    }

    /**
     * A list of names becomes a list of entrants. A name already known is
     * reported back as a warning and used as it is, rather than creating a
     * second player with the same name.
     */
    async addPlayersToDivision(
        playerNames: string[],
        divisionId: number,
    ): Promise<{ entrants: EntrantDto[]; warnings: string[] }> {
        const normalized = [...new Set(playerNames.map((name) => name.trim().toLowerCase()).filter((name) => name.length > 0))];
        const tournamentId = await this.tournamentOf(divisionId);

        const warnings: string[] = [];
        const participantIds: number[] = [];
        for (const name of normalized) {
            const known = await this.playerService.findByName(name);
            if (known) warnings.push(name);

            const player = known ?? (await this.playerService.create(name));
            const participant = await this.participantService.ensureForPlayer(tournamentId, player.id, ['competitor']);
            participantIds.push(participant.id);
        }

        const admitted = new Set(await this.divisionCommands.addParticipants(divisionId, participantIds));
        const entrants = (await this.divisionQueries.entrants(divisionId)).filter((entrant) => admitted.has(entrant.id));

        return { entrants, warnings };
    }

    private async tournamentOf(divisionId: number): Promise<number> {
        const tournamentId = await this.divisionQueries.tournamentIdOf(divisionId);
        if (!tournamentId) throw new NotFoundException(`Division ${divisionId} not found`);

        return tournamentId;
    }
}
