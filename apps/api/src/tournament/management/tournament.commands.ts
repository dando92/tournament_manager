import { Injectable } from '@nestjs/common';

import { AccountCommands } from '@account/account.commands';
import { UiUpdatePublisher } from '@tournament/shared/ui-update.publisher';
import { TournamentAggregate, TournamentDetails } from '@tournament/management/tournament.aggregate';
import { TournamentStore } from '@tournament/management/tournament.store';
import { TournamentSyncStartService } from '@tournament/syncstart/tournament-syncstart.service';
import { ControlRoomRunner } from '@tournament/competition/control-room/control-room.runner';

export type CreateTournamentInput = TournamentDetails & {
    name: string;
    ownerAccountId?: string;
};

/**
 * Every change a tournament undergoes.
 *
 * Each command is the same four steps: load the aggregate once, apply the
 * change in memory, save once, publish once. Two things moved in here from the
 * controller, because they are consequences of the write rather than decisions
 * the caller makes: registering the person who created a tournament as its
 * owner, and telling SyncStart where the tournament's lobbies live. The
 * controller used to compare the previous SyncStart URL with the new one to
 * decide whether to reconfigure, which meant the write had to answer with the
 * value it replaced.
 *
 * A tournament announced nothing at all before this. Renaming one, changing its
 * scoring system or closing it moved for whoever did it and for nobody else.
 */
@Injectable()
export class TournamentCommands {
    constructor(
        private readonly store: TournamentStore,
        private readonly publisher: UiUpdatePublisher,
        private readonly accounts: AccountCommands,
        private readonly syncStart: TournamentSyncStartService,
        private readonly controlRoom: ControlRoomRunner,
    ) {}

    /** Answers with the new tournament id: the caller navigates into what it made. */
    async create(input: CreateTournamentInput): Promise<number> {
        const tournament = TournamentAggregate.create(input);

        if (input.ownerAccountId) {
            const account = await this.accounts.ensurePlayer(input.ownerAccountId);
            const owner = tournament.register(account.player, ['owner']);
            tournament.linkAccount(owner, account);
        }

        await this.store.save(tournament);
        if (tournament.syncstartUrl) await this.syncStart.configureTournament(tournament.id, tournament.syncstartUrl);

        return tournament.id;
    }

    async update(tournamentId: number, details: TournamentDetails): Promise<void> {
        const tournament = await this.store.loadOrFail(tournamentId);
        tournament.assertOpen();

        const previousSyncstartUrl = tournament.syncstartUrl;
        tournament.describe(details);

        await this.store.save(tournament);
        if (tournament.syncstartUrl !== previousSyncstartUrl) {
            await this.syncStart.configureTournament(tournamentId, tournament.syncstartUrl);
        }
        await this.publisher.emitTournamentUpdate(tournamentId);
    }

    /**
     * Closing and reopening tell SyncStart either way, because a lobby it still
     * holds is the state being corrected; only the event is conditional, since a
     * status that did not move is nothing for anybody to redraw.
     */
    async close(tournamentId: number): Promise<void> {
        const tournament = await this.store.loadOrFail(tournamentId);
        const closed = tournament.close();
        if (closed) await this.store.save(tournament);
        if (closed) await this.controlRoom.stopTournament(tournamentId);

        await this.syncStart.closeTournament(tournamentId);
        if (closed) await this.publisher.emitTournamentUpdate(tournamentId);
    }

    async reopen(tournamentId: number): Promise<void> {
        const tournament = await this.store.loadOrFail(tournamentId);
        const reopened = tournament.reopen();
        if (reopened) await this.store.save(tournament);

        await this.syncStart.configureTournament(tournamentId, tournament.syncstartUrl ?? '');
        if (reopened) await this.publisher.emitTournamentUpdate(tournamentId);
    }
}
