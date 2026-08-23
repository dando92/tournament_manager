import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntrantDto } from '@tournament-manager/contracts';
import { Participant, Player } from '@tournament-manager/persistence';

import { AccountService } from '@account/services/account.service';
import { PlayerService } from '@tournament/catalog/player.service';
import { TournamentStore } from '@tournament/management/tournament.store';
import { ParticipantQueries } from '@tournament/registration/participants.queries';
import { DivisionCommands } from '@tournament/structure/division/division.commands';
import { DivisionQueries } from '@tournament/structure/division/division.queries';

/** Who to register: an existing player, or a name that may become one. */
export type RegistrationInput = {
    playerId?: number;
    playerName?: string;
};

/**
 * Registering people in a tournament, and putting them in a division.
 *
 * This is the second surface on the tournament aggregate, the way the rounds
 * controller is a second surface on the match: the roster of participants is
 * part of the tournament and is loaded and saved through its store, but who may
 * register and how is a subject of its own with its own routes. `TournamentCommands`
 * is its sibling rather than its caller — neither one calls the other.
 *
 * Three things register somebody: a name, a chosen player, and a pasted list.
 * All three end in `TournamentAggregate.register`, which is what makes
 * registering the same person twice add a role instead of a row.
 *
 * Putting a participant into a division is left to `DivisionCommands`, which is
 * the aggregate that owns entrants and announces what it changed. A command may
 * reach into the structure below it; it never maintains the one above.
 */
@Injectable()
export class ParticipantsCommands {
    constructor(
        private readonly tournaments: TournamentStore,
        private readonly participants: ParticipantQueries,
        private readonly players: PlayerService,
        private readonly accounts: AccountService,
        private readonly divisions: DivisionCommands,
        private readonly divisionQueries: DivisionQueries,
    ) {}

    /** Answers with the participant id: the caller shows the person it just registered. */
    async register(tournamentId: number, input: RegistrationInput): Promise<number> {
        const tournament = await this.tournaments.loadOrFail(tournamentId);
        const participant = tournament.register(await this.playerFor(input));

        await this.tournaments.save(tournament);

        return participant.id;
    }

    /**
     * A pasted list becomes participants in one load and one save. An entry
     * naming a player registers that player; an entry naming nobody creates one,
     * because the preview the caller ran already decided which is which.
     */
    async importAll(tournamentId: number, entries: Array<{ name: string; playerId?: number }>): Promise<number[]> {
        const tournament = await this.tournaments.loadOrFail(tournamentId);
        const registered: number[] = [];

        for (const entry of entries) {
            const name = entry.name?.trim();
            if (!name) continue;

            const player = entry.playerId
                ? await this.playerOrFail(entry.playerId)
                : await this.players.create(name);
            registered.push(tournament.register(player).id);
        }

        await this.tournaments.save(tournament);

        return registered;
    }

    /**
     * A whole list of people at once, in the order the players are given.
     *
     * One load and one save whatever the length: an importer registering two
     * hundred people used to cost a query and a save each, against a roster it
     * could have held once.
     */
    async registerAll(tournamentId: number, players: Player[]): Promise<Participant[]> {
        const tournament = await this.tournaments.loadOrFail(tournamentId);
        const participants = players.map((player) => tournament.register(player));

        await this.tournaments.save(tournament);

        return participants;
    }

    /**
     * Somebody stops taking part.
     *
     * They leave every division they competed in first, because an entrant is
     * the division's record of them and only the division can withdraw one and
     * say so. One call per division, not per entrant: somebody belongs to a
     * division once.
     */
    async remove(tournamentId: number, participantId: number): Promise<void> {
        const tournament = await this.tournaments.load(tournamentId);
        /* Removing somebody who is not there is not an error: the roster is
           already what the caller asked for. */
        if (!tournament?.hasParticipant(participantId)) return;

        for (const divisionId of await this.participants.divisionsOf(tournamentId, participantId)) {
            await this.divisions.removeParticipant(divisionId, participantId);
        }

        tournament.unregister(participantId);
        await this.tournaments.save(tournament);
    }

    async grantStaff(tournamentId: number, participantId: number): Promise<void> {
        const tournament = await this.tournaments.loadOrFail(tournamentId);
        const participant = tournament.participant(participantId);
        const account = participant.account ?? await this.accounts.findByPlayerId(participant.player.id);
        tournament.grantStaff(participantId, account);

        await this.tournaments.save(tournament);
    }

    async revokeStaff(tournamentId: number, participantId: number): Promise<void> {
        const tournament = await this.tournaments.loadOrFail(tournamentId);
        tournament.revokeStaff(participantId);

        await this.tournaments.save(tournament);
    }

    /** A player competes in a division: they are registered in its tournament first. */
    async assignPlayerToDivision(playerId: number, divisionId: number): Promise<void> {
        const tournamentId = await this.tournamentOf(divisionId);
        const tournament = await this.tournaments.loadOrFail(tournamentId);
        const participant = tournament.register(await this.playerOrFail(playerId));

        await this.tournaments.save(tournament);
        await this.divisions.addParticipants(divisionId, [participant.id]);
    }

    async removePlayerFromDivision(playerId: number, divisionId: number): Promise<void> {
        await this.divisions.removePlayer(divisionId, playerId);
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
        const names = [...new Set(playerNames.map((name) => name.trim().toLowerCase()).filter((name) => name.length > 0))];
        const tournamentId = await this.tournamentOf(divisionId);
        const tournament = await this.tournaments.loadOrFail(tournamentId);

        const warnings: string[] = [];
        const participantIds: number[] = [];
        for (const name of names) {
            const known = await this.players.findByName(name);
            if (known) warnings.push(name);

            participantIds.push(tournament.register(known ?? await this.players.create(name)).id);
        }

        await this.tournaments.save(tournament);

        const admitted = new Set(await this.divisions.addParticipants(divisionId, participantIds));
        const entrants = (await this.divisionQueries.entrants(divisionId)).filter((entrant) => admitted.has(entrant.id));

        return { entrants, warnings };
    }

    /**
     * The player a registration names. A name that matches one already in the
     * catalogue registers that player rather than creating a namesake.
     */
    private async playerFor(input: RegistrationInput): Promise<Player> {
        if (input.playerId) return this.playerOrFail(input.playerId);

        const name = input.playerName?.trim();
        if (!name) throw new BadRequestException('playerId or playerName is required');

        return await this.players.findByNameNormalized(name) ?? await this.players.create(name);
    }

    private async playerOrFail(playerId: number): Promise<Player> {
        const player = await this.players.findById(playerId);
        if (!player) throw new NotFoundException(`Player ${playerId} not found`);

        return player;
    }

    private async tournamentOf(divisionId: number): Promise<number> {
        const tournamentId = await this.divisionQueries.tournamentIdOf(divisionId);
        if (!tournamentId) throw new NotFoundException(`Division ${divisionId} not found`);

        return tournamentId;
    }
}
