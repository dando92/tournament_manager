import { Injectable, Logger } from '@nestjs/common';
import { Player, Score, Song } from '@tournament-manager/persistence';
import { ScoringSystemProvider } from '@tournament-manager/scoring';

import { StartggMatchReporter } from '@api/integrations/startgg/startgg-match.reporter';
import { MatchAggregate, MatchDetails, MatchPoolState } from '@match/match.aggregate';
import { MatchStore } from '@match/match.store';
import { AdvancementManager } from '@match/services/advancement.manager';
import { UiUpdatePublisher } from '@match/services/ui-update.publisher';
import { StartggReportStatus } from '@tournament-manager/contracts';
import { RoundSourceDto } from '@match/match.requests';
import { SongRoller } from '@tournament/competition/services/song.roller';
import { AdvancementRuleService } from '@tournament/structure/services/advancement-rule.service';
import { PhaseGroupService } from '@tournament/structure/services/phase-group.service';

export type CreateMatchInput = MatchDetails & {
    phaseGroupId: number;
    entrantIds?: number[];
    songIds?: number[];
    tournamentId?: number;
    divisionId?: number;
    group?: string;
    levels?: string;
};

export type UpdateMatchInput = MatchDetails & {
    entrantIds?: number[];
    phaseGroupId?: number;
};

export type ScoreInput = {
    percentage: number;
    isFailed: boolean;
    scoreId?: number;
};

/**
 * Every change a match undergoes.
 *
 * Each command is the same four steps: load the aggregate once, apply the
 * change in memory, save once, publish once. The rules live in the aggregate
 * and the projection in the queries, so what is left here is the order of those
 * steps and the collaborators a match reaches outside itself — the pool whose
 * derived entrants follow its membership, the advancement a result sets off,
 * and the start.gg report that follows a completion.
 *
 * No command answers with a projection. The change reaches the interface
 * through the events each one publishes, so a client reads the match once
 * afterwards instead of being handed a copy here and another over the socket.
 */
@Injectable()
export class MatchCommands {
    private readonly logger = new Logger(MatchCommands.name);

    constructor(
        private readonly store: MatchStore,
        private readonly publisher: UiUpdatePublisher,
        private readonly scoringSystems: ScoringSystemProvider,
        private readonly advancement: AdvancementManager,
        private readonly phaseGroups: PhaseGroupService,
        private readonly advancementRules: AdvancementRuleService,
        private readonly songRoller: SongRoller,
        private readonly startgg: StartggMatchReporter,
    ) {}

    /** Answers with the new match id: the bracket systems build structures out of them. */
    async create(input: CreateMatchInput): Promise<number> {
        const phaseGroup = await this.store.loadPhaseGroup(input.phaseGroupId);
        const entrants = await this.store.loadEntrants(input.entrantIds ?? []);
        const match = MatchAggregate.create(input, phaseGroup, entrants);

        const songs = await this.rolledSongs(input);
        songs.forEach((song) => match.addRound(song));

        await this.store.save(match);
        await this.phaseGroups.syncDerivedEntrants(phaseGroup.id);
        await this.publisher.emitPhaseGroupUpdate(match.address);

        return match.id;
    }

    async update(matchId: number, input: UpdateMatchInput): Promise<void> {
        const match = await this.store.loadOrFail(matchId);
        const before = match.poolState;
        const membershipChanged = input.entrantIds !== undefined || input.phaseGroupId !== undefined;
        if (membershipChanged || input.scoringSystem !== undefined) match.assertEditable();

        const affectedPhaseGroupIds = new Set<number>([match.phaseGroupId]);
        match.describe(input);

        if (input.phaseGroupId !== undefined) {
            match.moveTo(await this.store.loadPhaseGroup(input.phaseGroupId));
            affectedPhaseGroupIds.add(input.phaseGroupId);
        }
        if (input.entrantIds !== undefined) {
            match.replaceEntrants(await this.store.loadEntrants(input.entrantIds));
        }

        await this.store.save(match);
        if (membershipChanged) {
            for (const phaseGroupId of affectedPhaseGroupIds) {
                await this.phaseGroups.syncDerivedEntrants(phaseGroupId);
            }
        }

        await this.announce(match, before);
        /* A match that changed hands or changed pools moves the counts of every
           pool it touched, whichever way its own standings went. */
        if (membershipChanged) {
            for (const phaseGroupId of affectedPhaseGroupIds) {
                await this.publisher.emitPhaseGroupUpdateByPhaseGroupId(phaseGroupId);
            }
        }
    }

    async delete(matchId: number): Promise<void> {
        const match = await this.store.load(matchId);
        if (!match) return;

        const address = match.address;
        await this.advancementRules.deleteInvolvingMatch(matchId);
        await this.store.remove(match);
        await this.phaseGroups.syncDerivedEntrants(address.phaseGroupId);
        await this.publisher.emitPhaseGroupUpdate(address);
    }

    async setActive(matchId: number, active: boolean): Promise<void> {
        const match = await this.store.loadOrFail(matchId);
        match.activate(active);

        await this.store.save(match);
        await this.publisher.emitMatchUpdate(match.address);
    }

    /** The bracket systems fill a match one entrant at a time as they build it. */
    async addEntrant(matchId: number, entrantId: number): Promise<void> {
        const match = await this.store.load(matchId);
        if (!match) return;
        match.assertEditable();

        const [entrant] = await this.store.loadEntrants([entrantId]);
        if (!match.addEntrant(entrant)) return;

        await this.saveAndAnnounceMembership(match);
    }

    async removeEntrant(matchId: number, entrantId: number): Promise<void> {
        const match = await this.store.load(matchId);
        if (!match) return;
        match.assertEditable();
        if (!match.removeEntrant(entrantId)) return;

        await this.saveAndAnnounceMembership(match);
    }

    async addRound(matchId: number, source: RoundSourceDto): Promise<void> {
        const match = await this.store.loadOrFail(matchId);
        const before = match.poolState;
        match.assertEditable();
        await this.addRounds(match, source);

        await this.store.save(match);
        await this.announce(match, before);
    }

    async removeRound(roundId: number): Promise<void> {
        const match = await this.store.loadOrFail(await this.store.locateRound(roundId));
        const before = match.poolState;
        match.assertEditable();
        match.removeRound(roundId);

        await this.store.save(match);
        await this.announce(match, before);
    }

    /**
     * Swapping the song of a round drops the round and creates another, because
     * the standings under it were scored on the song that is leaving. Both halves
     * are one change to one aggregate, so they are one load and one save.
     */
    async replaceRoundSong(roundId: number, source: RoundSourceDto): Promise<void> {
        const match = await this.store.loadOrFail(await this.store.locateRound(roundId));
        const before = match.poolState;
        match.assertEditable();
        match.removeRound(roundId);
        await this.addRounds(match, source);

        await this.store.save(match);
        await this.announce(match, before);
    }

    async upsertScore(roundId: number, playerId: number, input: ScoreInput): Promise<void> {
        const match = await this.store.loadOrFail(await this.store.locateRound(roundId));
        const before = match.poolState;
        match.assertEditable();

        const player = await this.store.loadPlayer(playerId);
        const score = input.scoreId
            ? await this.store.loadScore(input.scoreId)
            : this.draftScore(player, match.songOf(roundId), input);

        match.upsertScore(roundId, player, score, this.scoringSystems);

        await this.store.save(match);
        await this.announce(match, before);
    }

    async upsertPoints(roundId: number, playerId: number, points: number): Promise<void> {
        const match = await this.store.loadOrFail(await this.store.locateRound(roundId));
        const before = match.poolState;
        match.assertEditable();
        match.upsertPoints(roundId, await this.store.loadPlayer(playerId), points);

        await this.store.save(match);
        await this.announce(match, before);
    }

    async removeStanding(roundId: number, playerId: number): Promise<void> {
        const match = await this.store.loadOrFail(await this.store.locateRound(roundId));
        const before = match.poolState;
        match.assertEditable();
        match.removeStanding(roundId, playerId);

        await this.store.save(match);
        await this.announce(match, before);
    }

    /**
     * Closing a match: it stops being editable, its entrants move on through the
     * advancement rules that leave it, and start.gg is told if it is linked.
     *
     * Re-committing an already committed match reverts its advancement first,
     * with the placements the previous result produced, because those are the
     * ones that were applied.
     */
    async commitResult(matchId: number): Promise<StartggReportStatus> {
        const match = await this.store.loadOrFail(matchId);
        const before = match.poolState;
        if (match.isCompleted) await this.advancement.revertFromMatch(match);

        match.commit();
        await this.store.save(match);

        await this.advancement.advanceFromMatch(match);
        const startggReport = await this.report(match);
        await this.announce(match, before);

        return startggReport;
    }

    async reopenResult(matchId: number): Promise<void> {
        const match = await this.store.loadOrFail(matchId);
        const before = match.poolState;
        if (match.isCompleted) await this.advancement.revertFromMatch(match);

        match.reopen();
        await this.store.save(match);
        await this.announce(match, before);
    }

    private async saveAndAnnounceMembership(match: MatchAggregate): Promise<void> {
        await this.store.save(match);
        await this.phaseGroups.syncDerivedEntrants(match.phaseGroupId);
        await this.publisher.emitMatchUpdate(match.address);
        await this.publisher.emitPhaseGroupUpdate(match.address);
    }

    /**
     * The events one write produces.
     *
     * Every write announces the match, which is what a pool's match list
     * follows. It announces the pool as well only when the pool's own
     * projection moved, because that is the read that costs a whole tree:
     * typing a percentage leaves the counts the tree draws where they were, and
     * settling the last standing of a match does not.
     */
    private async announce(match: MatchAggregate, before: MatchPoolState): Promise<void> {
        await this.publisher.emitMatchUpdate(match.address);

        const after = match.poolState;
        const poolChanged = after.completed !== before.completed || after.awaitingCommit !== before.awaitingCommit;
        if (poolChanged) await this.publisher.emitPhaseGroupUpdate(match.address);
    }

    /**
     * A round source either names a song or does not, and that decides which
     * kind of round is added. A roll that finds nothing adds no round at all:
     * it asked for a song and none was available, which is not the same as
     * asking for the hand-scored one.
     */
    private async addRounds(match: MatchAggregate, source: RoundSourceDto): Promise<void> {
        const wantsSong = Boolean(source.songId || source.level);
        match.assertRoundSourceAllowed(wantsSong);

        if (!wantsSong) {
            match.addRound(null);

            return;
        }

        const songs = await this.rolledSongs(source);
        songs.forEach((song) => match.addRound(song));
    }

    /**
     * The songs a round source names: a chosen one, or a roll over the
     * division's pool.
     */
    private async rolledSongs(source: {
        songId?: number;
        songIds?: number[];
        tournamentId?: number;
        divisionId?: number;
        group?: string;
        level?: string;
        levels?: string;
    }): Promise<Song[]> {
        const chosen = source.songIds ?? (source.songId ? [source.songId] : []);
        if (chosen.length > 0) return await this.store.loadSongs(chosen);

        const levels = source.levels ?? source.level;
        if (!levels) return [];

        const rolled = await this.songRoller.RollSongs(source.tournamentId, source.divisionId, source.group, levels);

        return await this.store.loadSongs(rolled);
    }

    private draftScore(player: Player, song: Song, input: ScoreInput): Score {
        const score = new Score();
        score.player = player;
        score.song = song;
        score.percentage = input.percentage;
        score.isFailed = input.isFailed;

        return score;
    }

    /**
     * Start.gg reporting is a best-effort side effect of a completed match: the
     * local result is already persisted, so a missing link or a provider failure
     * is reported back to the caller instead of failing the completion.
     */
    private async report(match: MatchAggregate): Promise<StartggReportStatus> {
        try {
            const reported = await this.startgg.reportCompletedMatch(match.entity);

            return reported ? 'reported' : 'skipped';
        } catch (error) {
            this.logger.error(`Reporting match ${match.id} to start.gg failed: ${error instanceof Error ? error.message : String(error)}`);

            return 'failed';
        }
    }
}
