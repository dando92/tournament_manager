import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntrantDto } from '@tournament-manager/contracts';
import { Participant, Player } from '@tournament-manager/persistence';

import { AccountStore } from '@account/account.store';
import { PlayerStore, normalizePlayerName } from '@tournament/catalog/player.store';
import { TournamentStore } from '@tournament/management/tournament.store';
import { ParticipantQueries } from '@tournament/registration/participants.queries';
import { UiUpdatePublisher } from '@tournament/shared/ui-update.publisher';
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
        private readonly players: PlayerStore,
        private readonly accounts: AccountStore,
        private readonly divisions: DivisionCommands,
        private readonly divisionQueries: DivisionQueries,
        private readonly publisher: UiUpdatePublisher,
    ) {}

    /** Answers with the participant id: the caller shows the person it just registered. */
    async register(tournamentId: number, input: RegistrationInput): Promise<number> {
        const tournament = await this.tournaments.loadOrFail(tournamentId);
        const participant = tournament.register(await this.playerFor(input));

        await this.tournaments.save(tournament);
        await this.publisher.emitTournamentUpdate(tournamentId);

        return participant.id;
    }

    /**
     * A pasted list becomes participants in one load and one save. An entry
     * naming a player registers that player; an entry naming nobody creates one,
     * because the preview the caller ran already decided which is which.
     */
    async importAll(tournamentId: number, entries: Array<{ name: string; playerId?: number }>): Promise<number[]> {
        const named = entries.filter((entry) => entry.name?.trim());
        const chosen = await this.playersOrFail(named.map((entry) => entry.playerId).filter(Boolean));
        const created = await this.players.createAll(
            named.filter((entry) => !entry.playerId).map((entry) => entry.name.trim()),
        );

        const tournament = await this.tournaments.loadOrFail(tournamentId);
        const registered = named.map((entry) =>
            tournament.register(entry.playerId ? chosen.get(entry.playerId) : created.shift()),
        );

        await this.tournaments.save(tournament);
        await this.publisher.emitTournamentUpdate(tournamentId);

        /* The ids are read after the save: somebody registered for the first
           time is a row that does not exist until then. */
        return registered.map((participant) => participant.id);
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
        await this.publisher.emitTournamentUpdate(tournamentId);

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
            await this.divisions.removeParticipants(divisionId, [participantId]);
        }

        tournament.unregister(participantId);
        await this.tournaments.save(tournament);
        await this.publisher.emitTournamentUpdate(tournamentId);
    }

    async grantStaff(tournamentId: number, participantId: number): Promise<void> {
        const tournament = await this.tournaments.loadOrFail(tournamentId);
        const participant = tournament.participant(participantId);
        const account = participant.account ?? await this.accounts.byPlayerId(participant.player.id);
        tournament.grantStaff(participantId, account);

        await this.tournaments.save(tournament);
        await this.publisher.emitTournamentUpdate(tournamentId);
    }

    async revokeStaff(tournamentId: number, participantId: number): Promise<void> {
        const tournament = await this.tournaments.loadOrFail(tournamentId);
        tournament.revokeStaff(participantId);

        await this.tournaments.save(tournament);
        await this.publisher.emitTournamentUpdate(tournamentId);
    }

    /** A player competes in a division: they are registered in its tournament first. */
    async assignPlayerToDivision(playerId: number, divisionId: number): Promise<void> {
        const tournamentId = await this.tournamentOf(divisionId);
        const players = await this.playersOrFail([playerId]);
        const tournament = await this.tournaments.loadOrFail(tournamentId);
        const participant = tournament.register(players.get(playerId));

        await this.tournaments.save(tournament);
        await this.publisher.emitTournamentUpdate(tournamentId);
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
        const names = this.distinctNames(playerNames);
        const tournamentId = await this.tournamentOf(divisionId);

        const known = await this.players.byNormalizedNames(names);
        const warnings = names.filter((name) => known.has(normalizePlayerName(name)));
        const created = await this.players.createAll(names.filter((name) => !known.has(normalizePlayerName(name))));
        created.forEach((player) => known.set(normalizePlayerName(player.playerName), player));

        const tournament = await this.tournaments.loadOrFail(tournamentId);
        const registered = names.map((name) => tournament.register(known.get(normalizePlayerName(name))));

        await this.tournaments.save(tournament);
        await this.publisher.emitTournamentUpdate(tournamentId);

        /* The ids are read after the save, for the same reason `importAll`
           reads them there: a participant registered for the first time has
           none until the roster is written. */
        const admitted = new Set(await this.divisions.addParticipants(divisionId, registered.map((participant) => participant.id)));
        const entrants = (await this.divisionQueries.entrants(divisionId)).filter((entrant) => admitted.has(entrant.id));

        return { entrants, warnings };
    }

    /**
     * The player a registration names. A name that matches one already in the
     * catalogue registers that player rather than creating a namesake.
     */
    private async playerFor(input: RegistrationInput): Promise<Player> {
        if (input.playerId) return (await this.playersOrFail([input.playerId])).get(input.playerId);

        const name = input.playerName?.trim();
        if (!name) throw new BadRequestException('playerId or playerName is required');

        const known = await this.players.byNormalizedNames([name]);

        return known.get(normalizePlayerName(name)) ?? (await this.players.createAll([name]))[0];
    }

    /** The players a request named, or the first id that names nobody. */
    private async playersOrFail(playerIds: number[]): Promise<Map<number, Player>> {
        const players = await this.players.byIds(playerIds);
        const missing = playerIds.find((playerId) => !players.has(playerId));
        if (missing) throw new NotFoundException(`Player ${missing} not found`);

        return players;
    }

    /**
     * The names a bulk add is for: trimmed, and distinct however they were
     * capitalized.
     *
     * They used to be lowercased instead, which is how they were then matched
     * against the catalogue and how anybody new was created. See FQ-022.
     */
    private distinctNames(playerNames: string[]): string[] {
        const seen = new Set<string>();

        return playerNames
            .map((name) => name.trim())
            .filter((name) => name.length > 0 && !seen.has(normalizePlayerName(name)) && seen.add(normalizePlayerName(name)));
    }

    private async tournamentOf(divisionId: number): Promise<number> {
        const tournamentId = await this.divisionQueries.tournamentIdOf(divisionId);
        if (!tournamentId) throw new NotFoundException(`Division ${divisionId} not found`);

        return tournamentId;
    }
}
