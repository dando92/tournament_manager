import { Injectable, NotFoundException } from '@nestjs/common';
import { Entrant, Player } from '@persistence/entities';
import { DivisionService } from '@tournament/services/division.service';
import { PlayerService } from '@player/player.service';
import { ParticipantService } from '@tournament/services/participant.service';
import { EntrantService } from '@tournament/services/entrant.service';

@Injectable()
export class PlayerManager {
    constructor(
        private readonly playerService: PlayerService,
        private readonly divisionService: DivisionService,
        private readonly participantService: ParticipantService,
        private readonly entrantService: EntrantService,
    ) {}

    async assignPlayerToDivision(playerId: number, divisionId: number): Promise<void> {
        const division = await this.divisionService.findEntrantsOnly(divisionId);
        if (!division) throw new NotFoundException(`Division ${divisionId} not found`);

        const alreadyLinked = (division.entrants ?? []).some((entrant) =>
            entrant.status === 'active' && entrant.participants?.some((participant) => participant.player.id === playerId),
        );
        if (alreadyLinked) {
            return;
        }

        const participant = await this.participantService.ensureForPlayer(division.tournament.id, playerId, ['competitor']);
        await this.entrantService.addSinglesEntrant(divisionId, participant.id);
    }

    async removePlayerFromDivision(playerId: number, divisionId: number): Promise<void> {
        const division = await this.divisionService.findEntrantsOnly(divisionId);
        if (!division) throw new NotFoundException(`Division ${divisionId} not found`);

        await this.entrantService.removeSinglesEntrantByPlayer(divisionId, playerId);
    }

    async addPlayersToDivision(
        playerNames: string[],
        divisionId: number,
    ): Promise<{ entrants: Entrant[]; warnings: string[] }> {
        const normalized = [...new Set(playerNames.map((n) => n.trim().toLowerCase()).filter((n) => n.length > 0))];

        const entrants: Entrant[] = [];
        const warnings: string[] = [];
        const division = await this.divisionService.findEntrantsOnly(divisionId);
        if (!division) throw new NotFoundException(`Division ${divisionId} not found`);

        for (const name of normalized) {
            let player = await this.playerService.findByName(name);
            if (player) {
                warnings.push(name);
            } else {
                player = await this.playerService.create(name);
            }
            const participant = await this.participantService.ensureForPlayer(division.tournament.id, player.id, ['competitor']);
            const entrant = await this.entrantService.addSinglesEntrant(divisionId, participant.id);
            entrants.push(entrant);
        }

        return { entrants, warnings };
    }
}
