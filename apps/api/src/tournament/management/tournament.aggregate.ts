import { ConflictException, NotFoundException } from '@nestjs/common';
import { Account, Participant, ParticipantRole, Player, Tournament } from '@tournament-manager/persistence';
import type { ScoringSystemType } from '@tournament-manager/scoring';

/** The fields of a tournament a person edits directly. */
export type TournamentDetails = {
    name?: string;
    syncstartUrl?: string;
    startggApiKey?: string | null;
    availableSetupsCount?: number;
    defaultScoringSystem?: ScoringSystemType;
};

/**
 * A tournament, the people registered in it, and the rules that govern
 * changing either.
 *
 * The registration is the part worth having rules for. A participant is one
 * person in one tournament, so registering somebody already registered adds the
 * role they were registered under rather than creating a second row — which is
 * what `ensureForPlayer` was, spelled as a query and a save. Roles accumulate
 * and never empty: somebody whose last role is taken away is `unknown` rather
 * than a participant with no reason to exist.
 *
 * Everything below changes the loaded graph in memory and nothing reads or
 * writes the database, so each rule can be exercised without one.
 */
export class TournamentAggregate {
    private removedParticipant: Participant | null = null;

    private constructor(private readonly tournament: Tournament) {}

    /** Wraps a tournament the store has loaded. */
    static of(tournament: Tournament): TournamentAggregate {
        return new TournamentAggregate(tournament);
    }

    /** A tournament that does not exist yet. Saving it gives it an id. */
    static create(details: TournamentDetails): TournamentAggregate {
        const tournament = new Tournament();
        tournament.name = details.name ?? '';
        tournament.participants = [];

        return new TournamentAggregate(tournament);
    }

    get id(): number {
        return this.tournament.id;
    }

    get entity(): Tournament {
        return this.tournament;
    }

    get isOpen(): boolean {
        return this.tournament.status !== 'closed';
    }

    /** Where SyncStart lobbies for this tournament are opened. */
    get syncstartUrl(): string {
        return this.tournament.syncstartUrl;
    }

    /** The participant the last `unregister` took off the roster, for the store to delete. */
    get removal(): Participant | null {
        return this.removedParticipant;
    }

    describe(details: TournamentDetails): void {
        const tournament = this.tournament;
        if (details.name !== undefined) tournament.name = details.name;
        if (details.syncstartUrl !== undefined) tournament.syncstartUrl = details.syncstartUrl;
        if (details.startggApiKey !== undefined) tournament.startggApiKey = details.startggApiKey;
        if (details.availableSetupsCount !== undefined) tournament.availableSetupsCount = details.availableSetupsCount;
        if (details.defaultScoringSystem !== undefined) tournament.defaultScoringSystem = details.defaultScoringSystem;
    }

    /**
     * A closed tournament is a record rather than a thing in progress, so
     * nothing under it may be changed until somebody reopens it.
     */
    assertOpen(): void {
        if (!this.isOpen) {
            throw new ConflictException(`Tournament with id ${this.tournament.id} is closed and must be reopened before it can be modified`);
        }
    }

    /** Answers whether the status actually moved: closing a closed tournament is not an event. */
    close(): boolean {
        if (!this.isOpen) return false;

        this.tournament.status = 'closed';
        this.tournament.closedAt = new Date();

        return true;
    }

    reopen(): boolean {
        if (this.isOpen) return false;

        this.tournament.status = 'open';
        this.tournament.closedAt = null;

        return true;
    }

    /**
     * Somebody takes part in this tournament.
     *
     * Registering a player who is already registered merges the roles instead of
     * creating a second participant, which is what makes this callable from the
     * three surfaces that register people — by name, by player, and by import.
     */
    register(player: Player, roles: ParticipantRole[] = ['competitor']): Participant {
        const existing = this.participantOfPlayer(player.id);
        if (existing) {
            existing.roles = mergeRoles(existing.roles, roles);

            return existing;
        }

        const participant = new Participant();
        participant.tournament = this.tournament;
        participant.player = player;
        participant.roles = mergeRoles([], roles);
        participant.status = 'registered';
        this.tournament.participants = [...(this.tournament.participants ?? []), participant];

        return participant;
    }

    /** The account behind a registered player, which is how a person signs in as themselves. */
    linkAccount(participant: Participant, account: Account): void {
        participant.account = account;
    }

    hasParticipant(participantId: number): boolean {
        return (this.tournament.participants ?? []).some((candidate) => candidate.id === participantId);
    }

    participant(participantId: number): Participant {
        const participant = (this.tournament.participants ?? []).find((candidate) => candidate.id === participantId);
        if (!participant) throw new NotFoundException(`Participant ${participantId} not found`);

        return participant;
    }

    /** Somebody stops taking part. Their entrants are the division's business. */
    unregister(participantId: number): Participant {
        const participant = this.participant(participantId);
        this.tournament.participants = (this.tournament.participants ?? []).filter((candidate) => candidate !== participant);
        this.removedParticipant = participant;

        return participant;
    }

    grantStaff(participantId: number, account: Account | null): Participant {
        const participant = this.participant(participantId);
        if (!participant.account && account) participant.account = account;
        participant.roles = mergeRoles(participant.roles, ['staff']);

        return participant;
    }

    revokeStaff(participantId: number): Participant {
        const participant = this.participant(participantId);
        participant.roles = (participant.roles ?? []).filter((role) => role !== 'staff');
        if (participant.roles.length === 0) participant.roles = ['unknown'];

        return participant;
    }

    /** Called once the store has written what the commands above decided. */
    settle(): void {
        this.removedParticipant = null;
    }

    private participantOfPlayer(playerId: number): Participant | undefined {
        return (this.tournament.participants ?? []).find((participant) => participant.player?.id === playerId);
    }
}

/** Roles are a set: `unknown` is the absence of one and never sits beside a real role. */
function mergeRoles(existing: ParticipantRole[] = [], incoming: ParticipantRole[]): ParticipantRole[] {
    const roles = new Set<ParticipantRole>(existing.filter((role) => role !== 'unknown'));
    incoming.forEach((role) => roles.add(role));

    return roles.size > 0 ? Array.from(roles) : ['unknown'];
}
