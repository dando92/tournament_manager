import { Entrant, Phase, PhaseGroup, PhaseGroupEntrant, PhaseGroupState } from '@tournament-manager/persistence';

/** Where a pool sits, and therefore where the events it produces are routed. */
export type PhaseGroupAddress = {
    tournamentId: number;
    divisionId: number;
    phaseId: number;
    phaseGroupId: number;
};

/** Where the phase above it sits, for the events that name the phase. */
export type PhaseAddress = {
    tournamentId: number;
    divisionId: number;
    phaseId: number;
};

/** The fields of a pool a person edits directly. */
export type PhaseGroupDetails = {
    name?: string;
    displayIdentifier?: string | null;
    bracketType?: string | null;
    state?: string;
};

/** Somebody a rule placed in this pool, and the slot the rule gave them. */
export type Placement = {
    entrant: Entrant;
    slot?: number | null;
    sourceAdvancementRuleId?: number | null;
};

const DEFAULT_IDENTIFIER = 'Pool';
const STATES: PhaseGroupState[] = ['pending', 'active', 'completed'];

/**
 * A pool and the rules that govern changing it.
 *
 * The seats are the part worth having rules for. A seat is what the pool itself
 * decided: the order a bracket was built in, or a placement an advancement rule
 * produced. Who plays here because a match in this pool holds them is not
 * seated and never was — that is derived, and `PhaseGroupQueries.entrants`
 * derives it, so nothing has to keep a copy of it in step.
 *
 * Everything below changes the loaded graph in memory and nothing reads or
 * writes the database, so each rule can be exercised without one.
 */
export class PhaseGroupAggregate {
    private readonly removedSeatIds: number[] = [];

    private constructor(private readonly phaseGroup: PhaseGroup) {}

    /** Wraps a pool the store has loaded. */
    static of(phaseGroup: PhaseGroup): PhaseGroupAggregate {
        return new PhaseGroupAggregate(phaseGroup);
    }

    /**
     * A pool that does not exist yet. Saving it gives it an id.
     *
     * It is called `Pool` when nobody supplied a name, and `Pool 2`, `Pool 3`
     * and so on once the phase already holds one. A phase with a single pool
     * does not draw it, so that first name is rarely read; the numbers start at
     * the second because that is the first one anybody sees.
     */
    static create(details: PhaseGroupDetails, phase: Phase): PhaseGroupAggregate {
        const displayIdentifier = details.displayIdentifier?.trim() || PhaseGroupAggregate.nextIdentifier(phase);

        const phaseGroup = new PhaseGroup();
        phaseGroup.name = details.name?.trim() || displayIdentifier;
        phaseGroup.displayIdentifier = displayIdentifier;
        phaseGroup.bracketType = details.bracketType ?? null;
        phaseGroup.state = 'pending';
        phaseGroup.phase = phase;
        phaseGroup.entrants = [];
        phaseGroup.matches = [];

        return new PhaseGroupAggregate(phaseGroup);
    }

    get id(): number {
        return this.phaseGroup.id;
    }

    get entity(): PhaseGroup {
        return this.phaseGroup;
    }

    get address(): PhaseGroupAddress {
        return { ...this.phaseAddress, phaseGroupId: this.phaseGroup.id };
    }

    get phaseAddress(): PhaseAddress {
        const phase = this.phaseGroup.phase;

        return {
            tournamentId: phase?.division?.tournament?.id,
            divisionId: phase?.division?.id,
            phaseId: phase?.id,
        };
    }

    /** The seats the store has to delete: a save only writes what is still here. */
    get removals(): number[] {
        return [...this.removedSeatIds];
    }

    /** Every match of this pool has been decided, and there is one to decide. */
    get isDecided(): boolean {
        const matches = this.phaseGroup.matches ?? [];

        return matches.length > 0 && matches.every((match) => Boolean(match.matchResult));
    }

    /**
     * The standings of the pool: every entrant by the points its matches gave
     * it. This is the order the rules that leave the pool read placements from.
     */
    get placements(): Entrant[] {
        const pointsByEntrantId = new Map<number, number>();
        const entrantsById = new Map<number, Entrant>();

        for (const match of this.phaseGroup.matches ?? []) {
            const pointsByPlayerId = new Map((match.matchResult?.playerPoints ?? []).map((entry) => [entry.playerId, entry.points]));
            for (const entrant of match.entrants ?? []) {
                const playerId = entrant.participants?.[0]?.player?.id;
                entrantsById.set(entrant.id, entrant);
                pointsByEntrantId.set(entrant.id, (pointsByEntrantId.get(entrant.id) ?? 0) + (pointsByPlayerId.get(playerId) ?? 0));
            }
        }

        return Array.from(entrantsById.values()).sort((left, right) =>
            (pointsByEntrantId.get(right.id) ?? 0) - (pointsByEntrantId.get(left.id) ?? 0) || left.id - right.id,
        );
    }

    describe(details: PhaseGroupDetails): void {
        if (details.name !== undefined) this.phaseGroup.name = details.name;
        if (details.displayIdentifier !== undefined) this.phaseGroup.displayIdentifier = details.displayIdentifier;
        if (details.bracketType !== undefined) this.phaseGroup.bracketType = details.bracketType;
        if (details.state !== undefined && STATES.includes(details.state as PhaseGroupState)) {
            this.phaseGroup.state = details.state as PhaseGroupState;
        }
    }

    /**
     * The seating, in the order the entrants are given.
     *
     * A bracket seats everybody at once, so this is the whole list: somebody the
     * list does not name loses their seat. An entrant who already had one keeps
     * the row, and with it whichever rule put them here.
     */
    seat(entrants: Entrant[]): void {
        const seatsByEntrantId = new Map((this.phaseGroup.entrants ?? []).map((seat) => [seat.entrant.id, seat]));

        this.phaseGroup.entrants = entrants.map((entrant, index) => {
            const seat = seatsByEntrantId.get(entrant.id) ?? this.newSeat(entrant);
            seatsByEntrantId.delete(entrant.id);
            seat.seedNum = index + 1;
            seat.slot = index + 1;
            seat.status = 'active';

            return seat;
        });

        for (const seat of seatsByEntrantId.values()) this.drop(seat);
    }

    /**
     * Somebody a rule placed here. The slot the rule names is the one they take;
     * without one they take the next free slot, and somebody already seated
     * keeps the slot they had.
     */
    place(placement: Placement): void {
        const seats = this.phaseGroup.entrants ?? [];
        let seat = seats.find((candidate) => candidate.entrant.id === placement.entrant.id);
        if (!seat) {
            seat = this.newSeat(placement.entrant);
            this.phaseGroup.entrants = [...seats, seat];
        }

        const slot = placement.slot ?? seat.slot ?? this.nextSlot();
        seat.slot = slot;
        seat.seedNum = slot;
        seat.status = 'active';
        if (placement.sourceAdvancementRuleId) {
            seat.sourceAdvancementRule = { id: placement.sourceAdvancementRuleId } as PhaseGroupEntrant['sourceAdvancementRule'];
        }
    }

    /** The reverse of a placement: the seat the rule gave somebody is released. */
    release(entrantId: number): void {
        const seat = (this.phaseGroup.entrants ?? []).find((candidate) => candidate.entrant.id === entrantId);
        if (!seat) return;

        this.phaseGroup.entrants = (this.phaseGroup.entrants ?? []).filter((candidate) => candidate !== seat);
        this.drop(seat);
    }

    /** Who left this pool for the next one. Everybody else is competing again. */
    markAdvanced(entrantIds: number[]): void {
        const advanced = new Set(entrantIds);

        for (const seat of this.phaseGroup.entrants ?? []) {
            if (advanced.has(seat.entrant.id)) seat.status = 'advanced';
            else if (seat.status === 'advanced') seat.status = 'active';
        }
    }

    complete(): void {
        this.phaseGroup.state = 'completed';
    }

    reopen(): void {
        this.phaseGroup.state = 'active';
    }

    /** Called once the store has written what the commands above decided. */
    settle(): void {
        this.removedSeatIds.length = 0;
    }

    private newSeat(entrant: Entrant): PhaseGroupEntrant {
        const seat = new PhaseGroupEntrant();
        seat.phaseGroup = this.phaseGroup;
        seat.entrant = entrant;
        seat.status = 'active';

        return seat;
    }

    private drop(seat: PhaseGroupEntrant): void {
        if (seat.id) this.removedSeatIds.push(seat.id);
    }

    private nextSlot(): number {
        return (this.phaseGroup.entrants ?? []).reduce((max, seat) => Math.max(max, seat.slot ?? 0), 0) + 1;
    }

    private static nextIdentifier(phase: Phase): string {
        const pools = phase.phaseGroups ?? [];
        if (pools.length === 0) return DEFAULT_IDENTIFIER;

        const taken = new Set(
            pools
                .flatMap((phaseGroup) => [phaseGroup.displayIdentifier?.trim(), phaseGroup.name?.trim()])
                .filter((identifier): identifier is string => Boolean(identifier)),
        );
        let number = pools.length + 1;
        while (taken.has(`${DEFAULT_IDENTIFIER} ${number}`)) number += 1;

        return `${DEFAULT_IDENTIFIER} ${number}`;
    }
}
