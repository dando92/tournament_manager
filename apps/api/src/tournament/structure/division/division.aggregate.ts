import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Division, Entrant, Participant, Tournament } from '@tournament-manager/persistence';

/** Where a division sits, and therefore where the events it produces are routed. */
export type DivisionAddress = {
    tournamentId: number;
    divisionId: number;
};

/** The fields of a division a person edits directly. */
export type DivisionDetails = {
    name?: string;
};

/**
 * A division and the rules that govern changing it.
 *
 * The roster is the part worth having rules for: an entrant is never deleted,
 * because a withdrawal has to be reversible and the matches that entrant played
 * still point at it, so admitting somebody twice reactivates the row that is
 * already there. Everything below changes the loaded graph in memory and
 * nothing reads or writes the database, so each rule can be exercised without
 * one.
 */
export class DivisionAggregate {
    private constructor(private readonly division: Division) {}

    /** Wraps a division the store has loaded. */
    static of(division: Division): DivisionAggregate {
        return new DivisionAggregate(division);
    }

    /** A division that does not exist yet. Saving it gives it an id. */
    static create(details: DivisionDetails, tournament: Tournament): DivisionAggregate {
        const division = new Division();
        division.name = details.name ?? '';
        division.tournament = tournament;
        division.entrants = [];
        division.phases = [];

        return new DivisionAggregate(division);
    }

    get id(): number {
        return this.division.id;
    }

    get entity(): Division {
        return this.division;
    }

    get address(): DivisionAddress {
        return {
            tournamentId: this.division.tournament?.id,
            divisionId: this.division.id,
        };
    }

    /** The number a generated phase takes in its name, when nobody supplied one. */
    get nextPhaseNumber(): number {
        return (this.division.phases?.length ?? 0) + 1;
    }

    /**
     * Who competes, in the order the division seeded them.
     *
     * An unseeded entrant sorts after every seeded one and then by name, which
     * is the order `DivisionQueries.entrants` returns and therefore the order
     * the seeding page shows. A bracket built from this list takes its slots in
     * that same order; before this the list came back in whatever order the
     * database happened to produce.
     */
    get activeEntrants(): Entrant[] {
        return (this.division.entrants ?? [])
            .filter((entrant) => entrant.status === 'active')
            .sort(
                (left, right) =>
                    (left.seedNum ?? Number.MAX_SAFE_INTEGER) - (right.seedNum ?? Number.MAX_SAFE_INTEGER)
                    || left.name.localeCompare(right.name)
                    || left.id - right.id,
            );
    }

    describe(details: DivisionDetails): void {
        if (details.name !== undefined) this.division.name = details.name;
    }

    moveTo(tournament: Tournament): void {
        this.division.tournament = tournament;
    }

    /**
     * The seeding, in the order the ids are given.
     *
     * An entrant the list does not name keeps the number it had: the interface
     * sends the rows it reordered, not the whole roster.
     */
    seed(entrantIds: number[]): void {
        const entrantsById = new Map((this.division.entrants ?? []).map((entrant) => [entrant.id, entrant]));

        entrantIds.forEach((entrantId, index) => {
            const entrant = entrantsById.get(entrantId);
            if (!entrant) throw new NotFoundException(`Entrant ${entrantId} does not belong to division ${this.division.id}`);

            entrant.seedNum = index + 1;
        });
    }

    /**
     * Somebody competes in this division.
     *
     * A participant who was here before keeps the entrant they had, with the
     * matches and the seed number attached to it, so a removal followed by an
     * admission is the reversal it looks like.
     */
    admit(participant: Participant): Entrant {
        const existing = this.entrantOfParticipant(participant.id);
        if (existing) {
            existing.status = 'active';

            return existing;
        }

        const entrant = new Entrant();
        entrant.division = this.division;
        entrant.name = participant.player.playerName;
        entrant.type = 'player';
        entrant.status = 'active';
        entrant.participants = [participant];
        this.division.entrants = [...(this.division.entrants ?? []), entrant];

        return entrant;
    }

    /** Somebody stops competing. The entrant stays, because its matches do. */
    withdrawParticipant(participantId: number): void {
        const entrant = this.entrantOfParticipant(participantId);
        if (entrant) entrant.status = 'withdrawn';
    }

    withdrawPlayer(playerId: number): void {
        const entrant = (this.division.entrants ?? []).find((candidate) =>
            (candidate.participants ?? []).some((participant) => participant.player?.id === playerId),
        );
        if (entrant) entrant.status = 'withdrawn';
    }

    /** A bracket needs somebody to put in it. */
    assertCanGenerateBracket(): void {
        if (this.activeEntrants.length === 0) {
            throw new BadRequestException('Cannot generate a bracket without active entrants.');
        }
    }

    private entrantOfParticipant(participantId: number): Entrant | undefined {
        return (this.division.entrants ?? []).find((entrant) =>
            (entrant.participants ?? []).some((participant) => participant.id === participantId),
        );
    }
}
