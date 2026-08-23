import { BadRequestException, Injectable } from '@nestjs/common';
import { GenerateBracketResultDto } from '@tournament-manager/contracts';

import { BracketSystemProvider } from '@bracket/BracketSystemProvider';
import { UiUpdatePublisher } from '@match/services/ui-update.publisher';
import { DivisionAggregate, DivisionDetails } from '@tournament/structure/division/division.aggregate';
import { DivisionStore } from '@tournament/structure/division/division.store';
import { PhaseGroupService } from '@tournament/structure/services/phase-group.service';
import { PhaseService } from '@tournament/structure/services/phase.service';

export type CreateDivisionInput = DivisionDetails & {
    name: string;
    tournamentId: number;
};

export type UpdateDivisionInput = DivisionDetails & {
    tournamentId?: number;
};

export type GenerateBracketInput = {
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
        private readonly phases: PhaseService,
        private readonly phaseGroups: PhaseGroupService,
        private readonly bracketSystems: BracketSystemProvider,
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
     * Answers with the phase and the pool it built, for the same reason a
     * creation answers with an id: the caller navigates into them.
     *
     * The phase and the pool publish their own events as they are created, and
     * so does every match the system builds, so nothing is published here.
     */
    async generateBracket(divisionId: number, input: GenerateBracketInput): Promise<GenerateBracketResultDto> {
        const division = await this.store.loadOrFail(divisionId);
        division.assertCanGenerateBracket();

        const system = this.bracketSystems.getBracketSystem(input.bracketType);
        if (!system) throw new BadRequestException(`Unknown bracket type ${input.bracketType}`);

        const phase = await this.phases.create({
            divisionId,
            name: input.phaseName?.trim() || `Bracket ${division.nextPhaseNumber}`,
        });
        const phaseGroup = await this.phaseGroups.createForPhase(phase.id, { bracketType: input.bracketType });
        await system.generateForExistingPhaseGroup(
            phase,
            phaseGroup,
            division.activeEntrants,
            input.playerPerMatch ?? 2,
        );

        return { phaseId: phase.id, phaseGroupId: phaseGroup.id };
    }
}
