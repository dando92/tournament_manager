import { BadRequestException, Injectable } from '@nestjs/common';
import { GenerateBracketResultDto } from '@tournament-manager/contracts';

import { BracketCommands } from '@bracket/bracket.commands';
import { UiUpdatePublisher } from '@tournament/shared/ui-update.publisher';
import { DivisionAggregate, DivisionDetails } from '@tournament/structure/division/division.aggregate';
import { DivisionStore } from '@tournament/structure/division/division.store';
import { PhaseGroupCommands } from '@tournament/structure/phase-group/phase-group.commands';

export type CreateDivisionInput = DivisionDetails & {
    name: string;
    tournamentId: number;
};

export type UpdateDivisionInput = DivisionDetails & {
    tournamentId?: number;
};

export type GenerateBracketInput = {
    /** The phase to build in. Without one the bracket brings a new phase with it. */
    phaseId?: number;
    phaseName?: string;
    bracketType: string;
    playerPerMatch?: number;
};

/**
 * Every change a division undergoes.
 *
 * Each command is the same four steps: load the aggregate once, apply the
 * change in memory, save once, publish once. The roster commands are the ones
 * that gained something here — admitting and withdrawing somebody published
 * nothing before, so a person added to a division appeared only for whoever
 * added them and everybody else was left with a stale roster until they
 * reloaded the page.
 *
 * Bracket generation is a command on Division because that is the aggregate it
 * changes: it creates a phase, a pool and the matches of a structure, and the
 * division is what decides who is in it.
 */
@Injectable()
export class DivisionCommands {
    constructor(
        private readonly store: DivisionStore,
        private readonly publisher: UiUpdatePublisher,
        private readonly phaseGroups: PhaseGroupCommands,
        private readonly bracketSystems: BracketCommands,
    ) {}

    /** Answers with the new division id: the caller navigates into what it made. */
    async create(input: CreateDivisionInput): Promise<number> {
        const tournament = await this.store.loadTournament(input.tournamentId);
        const division = DivisionAggregate.create(input, tournament);

        await this.store.save(division);
        await this.publisher.emitTournamentUpdate(tournament.id);

        return division.id;
    }

    async update(divisionId: number, input: UpdateDivisionInput): Promise<void> {
        const division = await this.store.loadOrFail(divisionId);
        division.describe(input);
        if (input.tournamentId !== undefined) {
            division.moveTo(await this.store.loadTournament(input.tournamentId));
        }

        await this.store.save(division);
        await this.publisher.emitDivisionUpdate(division.address);
    }

    async delete(divisionId: number): Promise<void> {
        const division = await this.store.load(divisionId);
        if (!division) return;

        const { tournamentId } = division.address;
        await this.store.remove(division);
        await this.publisher.emitTournamentUpdate(tournamentId);
    }

    async updateSeeding(divisionId: number, entrantIds: number[]): Promise<void> {
        const division = await this.store.loadOrFail(divisionId);
        division.seed(entrantIds);

        await this.store.save(division);
        await this.publisher.emitDivisionUpdate(division.address);
    }

    /**
     * Answers with the entrant ids, in the order the participants were given.
     * One load and one save whether it admits one person or a list of them.
     */
    async addParticipants(divisionId: number, participantIds: number[]): Promise<number[]> {
        const division = await this.store.loadOrFail(divisionId);
        const participants = await this.store.loadParticipants(participantIds);
        const entrants = participants.map((participant) => division.admit(participant));

        await this.store.save(division);
        await this.publisher.emitDivisionUpdate(division.address);

        return entrants.map((entrant) => entrant.id);
    }

    async removeParticipant(divisionId: number, participantId: number): Promise<void> {
        const division = await this.store.loadOrFail(divisionId);
        division.withdrawParticipant(participantId);

        await this.store.save(division);
        await this.publisher.emitDivisionUpdate(division.address);
    }

    async removePlayer(divisionId: number, playerId: number): Promise<void> {
        const division = await this.store.loadOrFail(divisionId);
        division.withdrawPlayer(playerId);

        await this.store.save(division);
        await this.publisher.emitDivisionUpdate(division.address);
    }

    /**
     * A phase, and the pool every phase starts with.
     *
     * A phase is part of the division rather than an aggregate of its own, so
     * these are division commands: they load the division, change its
     * structure, save once and announce the division. The pool is created by
     * the pool's own commands, which is the one direction a command may reach
     * in — downwards, into the structure it is making.
     */
    async addPhase(divisionId: number, name: string, withDefaultPhaseGroup = true): Promise<number> {
        const division = await this.store.loadOrFail(divisionId);
        const phase = division.addPhase(name);

        await this.store.save(division);
        await this.publisher.emitDivisionUpdate(division.address);
        if (withDefaultPhaseGroup) await this.phaseGroups.create(phase.id, {});

        return phase.id;
    }

    async renamePhase(phaseId: number, name: string): Promise<void> {
        const division = await this.store.loadOrFail(await this.store.locatePhase(phaseId));
        division.renamePhase(phaseId, name);

        await this.store.save(division);
        await this.publisher.emitDivisionUpdate(division.address);
    }

    async removePhase(phaseId: number): Promise<void> {
        const division = await this.store.loadOrFail(await this.store.locatePhase(phaseId));
        division.removePhase(phaseId);

        await this.store.save(division);
        await this.publisher.emitDivisionUpdate(division.address);
    }

    /**
     * Answers with the phase and the pool it built, for the same reason a
     * creation answers with an id: the caller navigates into them.
     *
     * A bracket asked for inside an existing phase is built there, in that
     * phase's own pool when it is still empty; asked for without one it brings a
     * new phase with it. Only the second changes the division, which is why the
     * save and its event are on that branch alone.
     *
     * The phase and the pool publish their own events as they are created, and
     * so does every match the system builds, so nothing is published here.
     */
    async generateBracket(divisionId: number, input: GenerateBracketInput): Promise<GenerateBracketResultDto> {
        const division = await this.store.loadOrFail(divisionId);
        division.assertCanGenerateBracket();

        const system = this.bracketSystems.getBracketSystem(input.bracketType);
        if (!system) throw new BadRequestException(`Unknown bracket type ${input.bracketType}`);

        const entrants = division.activeEntrants;
        const phase = input.phaseId
            ? division.phase(input.phaseId)
            : division.addPhase(input.phaseName?.trim() || `Bracket ${division.nextPhaseNumber}`);

        if (!input.phaseId) {
            await this.store.save(division);
            await this.publisher.emitDivisionUpdate(division.address);
        }

        const phaseGroupId = await this.phaseGroups.createForBracket(phase.id, input.bracketType);
        await system.generateForExistingPhaseGroup(phase, phaseGroupId, entrants, input.playerPerMatch ?? 2);

        return { phaseId: phase.id, phaseGroupId };
    }
}
