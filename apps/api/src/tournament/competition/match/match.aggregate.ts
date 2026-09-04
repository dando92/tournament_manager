import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
    AdvancementRule,
    Entrant,
    Match,
    MatchResult,
    MatchTiebreak,
    MatchTiebreakStanding,
    PhaseGroup,
    Player,
    Round,
    Score,
    Song,
    Standing,
} from '@tournament-manager/persistence';
import type { MatchState } from '@tournament-manager/persistence';
import type { MatchResultStateDto } from '@tournament-manager/contracts';
import type { ScoringSystemProvider, ScoringSystemType } from '@tournament-manager/scoring';
import { resolvePlacements, TiebreakPlacementInput } from '@match/placement.resolver';

/** Where a match sits, and therefore where the events it produces are routed. */
export type MatchAddress = {
    tournamentId: number;
    divisionId: number;
    phaseId: number;
    phaseGroupId: number;
    matchId: number;
};

/**
 * What a save must delete. Writing the graph covers everything that was added
 * or changed; a row that left one of its collections is only visible here.
 */
export type MatchRemovals = {
    roundIds: number[];
    standingIds: number[];
    tiebreakIds: number[];
    matchResultId: number | null;
};

/**
 * The part of a match the pool's projection shows. A change to it is a change
 * to the tree, and a change to nothing else in it is not.
 */
export type MatchPoolState = {
    completed: boolean;
    awaitingCommit: boolean;
    awaitingResolution: boolean;
    progressed: boolean;
};

/** The fields of a match a person edits directly. */
export type MatchDetails = {
    name?: string;
    subtitle?: string;
    notes?: string;
    scoringSystem?: ScoringSystemType;
};

type PlayedStanding = Standing & { score: Score };

function isPlayed(standing: Standing): standing is PlayedStanding {
    return Boolean(standing.score);
}

function sameIds(left: number[], right: number[]): boolean {
    return left.length === right.length && [...left].sort((a, b) => a - b).every((id, index) => id === right[index]);
}

/**
 * A match and the rules that govern changing it.
 *
 * It holds the loaded graph and changes it in memory: nothing here reads or
 * writes the database, so every rule below can be exercised without one. The
 * store puts the result back, which is why removals are recorded rather than
 * performed — a row that left a collection cannot be inferred from the graph
 * that remains.
 */
export class MatchAggregate {
    private readonly removedRoundIds = new Set<number>();
    private readonly removedStandingIds = new Set<number>();
    private readonly removedTiebreakIds = new Set<number>();
    private removedMatchResultId: number | null = null;

    private constructor(
        private readonly match: Match,
        private readonly advancementRules: AdvancementRule[] = [],
    ) {}

    /** Wraps a match the store has loaded. */
    static of(match: Match, advancementRules: AdvancementRule[] = []): MatchAggregate {
        return new MatchAggregate(match, advancementRules);
    }

    /** A match that does not exist yet. Saving it gives it an id. */
    static create(details: MatchDetails, phaseGroup: PhaseGroup, entrants: Entrant[]): MatchAggregate {
        const match = new Match();
        match.name = details.name;
        match.subtitle = details.subtitle;
        match.notes = details.notes;
        match.scoringSystem = details.scoringSystem;
        match.active = false;
        match.state = 'open';
        match.phaseGroup = phaseGroup;
        match.entrants = entrants;
        match.rounds = [];
        match.tiebreaks = [];
        match.matchResult = null;

        return new MatchAggregate(match);
    }

    get id(): number {
        return this.match.id;
    }

    /** The graph the store writes. Nothing else reads it. */
    get entity(): Match {
        return this.match;
    }

    get phaseGroupId(): number {
        return this.match.phaseGroup?.id;
    }

    get isCompleted(): boolean {
        return Boolean(this.match.matchResult);
    }

    /** The current preview the UI reads and the commit freezes. */
    get resultState(): MatchResultStateDto {
        if (this.match.matchResult) {
            return { status: 'completed', entries: this.match.matchResult.playerPoints ?? [], ambiguousTies: [] };
        }

        return this.calculatedResultState();
    }

    private calculatedResultState(): MatchResultStateDto {
        const points = this.calculatePoints();
        if (!points) return { status: 'incomplete', entries: [], ambiguousTies: [] };

        const resolution = resolvePlacements(points, this.tiebreakPlacementInputs(), this.outgoingAdvancementRules());
        return {
            status: resolution.ambiguousTies.length > 0 ? 'tiebreak_required' : 'ready',
            ...resolution,
        };
    }

    /**
     * Where the match stands, in the one place that decides it.
     *
     * `MatchStore` writes this to `match."state"` on every save, and the reads
     * that used to re-derive it — the pool counts of the tree above all — filter on
     * the column instead. Nothing else may compute it: a second definition is
     * exactly the drift `PerformanceReadiness.md` batch S exists to remove, and
     * the invariant test in `match-writes.e2e-spec.ts` fails when the column and
     * this getter disagree.
     *
     * A settled match always carries evidence — a played round is settled only
     * when every player has a score in it, and a hand-scored one only when
     * somebody has points above zero — so `open` is the only state that means
     * nothing has happened yet.
     */
    get state(): MatchState {
        if (this.isCompleted) {
            return 'completed';
        }

        const { status } = this.calculatedResultState();
        if (status === 'ready' || status === 'tiebreak_required') {
            return status;
        }

        return this.hasEvidence() ? 'partial' : 'open';
    }

    /**
     * What the tree draws about the pool this match sits in: how many of its
     * matches are waiting on a person, and how many are done.
     *
     * It is `state` read four ways, so the predicate the pool counts and the
     * predicate a match is stored under cannot come apart. A command compares
     * this before and after its change to know whether the pool's projection
     * moved, which is what decides whether an event addressed to the pool
     * follows the one addressed to the match.
     */
    get poolState(): MatchPoolState {
        const state = this.state;

        return {
            completed: state === 'completed',
            awaitingCommit: state === 'ready',
            awaitingResolution: state === 'ready' || state === 'tiebreak_required',
            progressed: state !== 'open',
        };
    }

    get entrants(): Entrant[] {
        return this.match.entrants ?? [];
    }

    get rounds(): Round[] {
        return this.match.rounds ?? [];
    }

    get tiebreaks(): MatchTiebreak[] {
        return this.match.tiebreaks ?? [];
    }

    /**
     * The address of every event this match produces.
     *
     * The store's graph reaches the tournament, so it is already in hand: no
     * write has to ask the database where the match it just changed lives.
     */
    get address(): MatchAddress {
        const phaseGroup = this.match.phaseGroup;
        const phase = phaseGroup?.phase;
        const division = phase?.division;

        return {
            tournamentId: division?.tournament?.id,
            divisionId: division?.id,
            phaseId: phase?.id,
            phaseGroupId: phaseGroup?.id,
            matchId: this.match.id,
        };
    }

    get removals(): MatchRemovals {
        return {
            roundIds: [...this.removedRoundIds],
            standingIds: [...this.removedStandingIds],
            tiebreakIds: [...this.removedTiebreakIds],
            matchResultId: this.removedMatchResultId,
        };
    }

    /** Called by the store once the removals above have been performed. */
    settle(): void {
        this.removedRoundIds.clear();
        this.removedStandingIds.clear();
        this.removedTiebreakIds.clear();
        this.removedMatchResultId = null;
    }

    /**
     * A completed match is frozen until its result is reopened.
     *
     * The commands call this for the edits a person makes. Advancement does not:
     * it writes the entrants of a target match that may already hold a result of
     * its own, and refusing that would leave a bracket half reverted.
     */
    assertEditable(): void {
        if (this.match.matchResult) {
            throw new BadRequestException('Completed matches do not allow editing');
        }
    }

    describe(details: MatchDetails): void {
        if (details.name !== undefined) this.match.name = details.name;
        if (details.subtitle !== undefined) this.match.subtitle = details.subtitle;
        if (details.notes !== undefined) this.match.notes = details.notes;
    }

    /**
     * Changes how played rounds award points and immediately makes every round
     * agree with the new strategy. Hand-scored points are stated by a person,
     * so changing a calculator never touches them.
     */
    changeScoringSystem(scoringSystem: ScoringSystemType, scoringSystems: ScoringSystemProvider): void {
        if (scoringSystem === this.match.scoringSystem) {
            return;
        }

        this.match.scoringSystem = scoringSystem;
        this.resettle(scoringSystems);
    }

    moveTo(phaseGroup: PhaseGroup): void {
        this.match.phaseGroup = phaseGroup;
    }

    /**
     * Who is in the match.
     *
     * Every one of these four settles the rounds afterwards, because the points
     * of a round rank the people who played it: they are not a property of one
     * person's run, and they stop meaning anything the moment the field
     * changes.
     */
    replaceEntrants(entrants: Entrant[], scoringSystems: ScoringSystemProvider): void {
        this.match.entrants = entrants;
        this.resettle(scoringSystems);
    }

    /** Answers whether the match changed, so a caller can skip a pointless save. */
    addEntrant(entrant: Entrant, scoringSystems: ScoringSystemProvider): boolean {
        if (this.entrants.some((candidate) => candidate.id === entrant.id)) return false;
        this.match.entrants = [...this.entrants, entrant];
        this.resettle(scoringSystems);

        return true;
    }

    removeEntrant(entrantId: number, scoringSystems: ScoringSystemProvider): boolean {
        const remaining = this.entrants.filter((candidate) => candidate.id !== entrantId);
        if (remaining.length === this.entrants.length) return false;
        this.match.entrants = remaining;
        this.resettle(scoringSystems);

        return true;
    }

    /** Puts an entrant in a slot, moving it when it is already in the match. */
    placeEntrant(entrant: Entrant, slot: number, scoringSystems: ScoringSystemProvider): void {
        const others = this.entrants.filter((candidate) => candidate.id !== entrant.id);
        const index = Math.max(slot - 1, 0);

        if (index >= others.length) others.push(entrant);
        else others.splice(index, 0, entrant);

        this.match.entrants = others;
        this.resettle(scoringSystems);
    }

    activate(active: boolean): void {
        if (active && this.match.matchResult) {
            throw new BadRequestException('Completed matches must be re-opened before activation');
        }
        this.match.active = active;
    }

    /**
     * A match is scored one way or the other. The model allows both kinds of
     * round side by side and the commit would sum them, but mixing them is
     * deliberately not offered yet: see .ai/ScoringRefactoring.md.
     */
    assertRoundSourceAllowed(wantsSong: boolean): void {
        const handScored = this.rounds.some((round) => !round.song);

        if (wantsSong && handScored) {
            throw new BadRequestException(`Match ${this.match.id} is scored by hand; remove hand scoring before adding songs`);
        }
        if (!wantsSong && this.rounds.length > 0) {
            throw new BadRequestException(`Match ${this.match.id} already has songs; remove them before scoring it by hand`);
        }
    }

    /**
     * Adds one round.
     *
     * A song makes it a played round and no song makes it the hand-scored one.
     * The database refuses a second hand-scored round and a repeated song, so
     * those two rules fail as constraint violations rather than passing here
     * unnoticed.
     */
    addRound(song: Song | null): Round {
        this.invalidateTiebreaks();
        const round = new Round();
        round.song = song;
        round.standings = [];
        round.matchAssignments = [];
        this.match.rounds = [...this.rounds, round];

        return round;
    }

    /**
     * Removes a round, and with it whatever was scored in it.
     *
     * Scores are not thrown away on the way past: a round played on a song keeps
     * them, and asking to drop one that still holds them is refused in words.
     * The hand-scored round is the exception, because deleting it is how the
     * interface turns hand scoring off, and it asks first.
     */
    removeRound(roundId: number): void {
        const round = this.roundOf(roundId);
        const scored = (round.standings ?? []).length > 0;

        if (scored && round.song) {
            throw new BadRequestException(
                `Round ${roundId} still holds scores for "${round.song.title}"; delete them before removing the song`,
            );
        }

        this.match.rounds = this.rounds.filter((candidate) => candidate.id !== roundId);
        this.removedRoundIds.add(roundId);
        this.invalidateTiebreaks();
    }

    /** The song a round was played on, which is what a score has to match. */
    songOf(roundId: number): Song | null {
        return this.roundOf(roundId).song ?? null;
    }

    /**
     * A played result: the percentage the cabinet reported, or one typed in its
     * place. The points are not the caller's to set — the scoring system
     * computes them from the percentages as soon as the round is full.
     */
    upsertScore(roundId: number, player: Player, score: Score, scoringSystems: ScoringSystemProvider): void {
        const round = this.roundOf(roundId);
        if (!round.song) {
            throw new BadRequestException(`Round ${roundId} is hand-scored and has no song to score`);
        }
        if (score.player?.id !== player.id || score.song?.id !== round.song.id) {
            throw new BadRequestException(`Score ${score.id} does not match the selected player and song`);
        }

        this.writeStanding(round, player, score, 0);
        this.rankIfComplete(round, scoringSystems);
        this.invalidateTiebreaks();
    }

    /** A stated result: points a person assigned, with nothing played behind them. */
    upsertPoints(roundId: number, player: Player, points: number): void {
        const round = this.roundOf(roundId);
        if (round.song) {
            throw new BadRequestException(
                `Round ${roundId} is scored from song ${round.song.id}; its points are computed, not assigned`,
            );
        }

        this.writeStanding(round, player, null, points);
        this.invalidateTiebreaks();
    }

    removeStanding(roundId: number, playerId: number): void {
        const round = this.roundOf(roundId);
        const standing = (round.standings ?? []).find((candidate) => candidate.player?.id === playerId);
        if (!standing) return;

        round.standings = round.standings.filter((candidate) => candidate !== standing);
        if (standing.id) this.removedStandingIds.add(standing.id);

        /* The round is incomplete again, so the ranking it produced no longer
           means anything and must not be left behind. */
        if (round.song) round.standings.forEach((candidate) => (candidate.points = 0));
        this.invalidateTiebreaks();
    }

    /** Adds one attempt for exactly one currently ambiguous tied group. */
    addTiebreak(song: Song | null, players: Player[]): MatchTiebreak {
        this.assertEditable();
        const requested = [...players].map((player) => player.id).sort((left, right) => left - right);
        const tie = this.resultState.ambiguousTies.find((candidate) =>
            sameIds(candidate.playerIds, requested),
        );
        if (!tie) {
            throw new BadRequestException('A tiebreak must contain exactly one currently ambiguous tied group');
        }
        if (this.tiebreaks.some((candidate) => !candidate.invalidated && !this.isTiebreakComplete(candidate))) {
            throw new BadRequestException('Complete or remove the current tiebreak before adding another');
        }

        const tiebreak = new MatchTiebreak();
        tiebreak.sequence = this.tiebreaks.reduce((maximum, candidate) => Math.max(maximum, candidate.sequence), 0) + 1;
        tiebreak.invalidated = false;
        tiebreak.song = song;
        /* A hand-scored attempt opens on zero the way a hand-scored round does:
           nobody has stated anything yet, and the first point stated is what
           makes the attempt an answer. A played attempt has no points of its
           own — its evidence is the score of each run. */
        tiebreak.standings = players.map((player) => {
            const standing = new MatchTiebreakStanding();
            standing.player = player;
            standing.score = null;
            standing.manualPoints = song ? null : 0;

            return standing;
        });
        this.match.tiebreaks = [...this.tiebreaks, tiebreak];

        return tiebreak;
    }

    removeTiebreak(tiebreakId: number): void {
        const tiebreak = this.tiebreakOf(tiebreakId);
        this.match.tiebreaks = this.tiebreaks.filter((candidate) => candidate !== tiebreak);
        if (tiebreak.id) this.removedTiebreakIds.add(tiebreak.id);
    }

    tiebreakSongOf(tiebreakId: number): Song | null {
        return this.tiebreakOf(tiebreakId).song ?? null;
    }

    upsertTiebreakScore(tiebreakId: number, player: Player, score: Score): void {
        const tiebreak = this.tiebreakOf(tiebreakId);
        if (tiebreak.invalidated) throw new BadRequestException(`Tiebreak ${tiebreakId} is invalidated`);
        if (!tiebreak.song) throw new BadRequestException(`Tiebreak ${tiebreakId} is scored by hand`);
        if (score.player?.id !== player.id || score.song?.id !== tiebreak.song.id) {
            throw new BadRequestException(`Score ${score.id} does not match the selected player and tiebreak song`);
        }

        const standing = this.tiebreakStandingOf(tiebreak, player.id);
        standing.score = score;
        standing.manualPoints = null;
    }

    upsertTiebreakPoints(tiebreakId: number, playerId: number, points: number): void {
        const tiebreak = this.tiebreakOf(tiebreakId);
        if (tiebreak.invalidated) throw new BadRequestException(`Tiebreak ${tiebreakId} is invalidated`);
        if (tiebreak.song) throw new BadRequestException(`Tiebreak ${tiebreakId} is scored from a song`);

        const standing = this.tiebreakStandingOf(tiebreak, playerId);
        standing.score = null;
        standing.manualPoints = points;
    }

    /** Takes back what was entered, leaving the attempt as it opened. */
    clearTiebreakStanding(tiebreakId: number, playerId: number): void {
        const tiebreak = this.tiebreakOf(tiebreakId);
        const standing = this.tiebreakStandingOf(tiebreak, playerId);
        standing.score = null;
        standing.manualPoints = tiebreak.song ? null : 0;
    }

    /**
     * Writes the result of the match and closes it.
     *
     * One rule, whatever the match was scored on: every player has a standing in
     * every round, and their result is the sum. A hand-scored match reaches this
     * through a round with no song, so nothing here has to know it was scored by
     * hand.
     */
    commit(): void {
        const state = this.calculatedResultState();
        if (state.status === 'incomplete') {
            throw new BadRequestException(`Match ${this.match.id} cannot be completed because not all standings are populated`);
        }
        if (state.status === 'tiebreak_required') {
            throw new BadRequestException({
                code: 'MATCH_TIEBREAK_REQUIRED',
                message: `Match ${this.match.id} cannot be completed because an advancement placement is tied`,
                ties: state.ambiguousTies,
            });
        }

        const result = this.match.matchResult ?? new MatchResult();
        result.playerPoints = state.entries;
        this.match.matchResult = result;
        this.match.active = false;
    }

    reopen(): void {
        if (this.match.matchResult?.id) {
            this.removedMatchResultId = this.match.matchResult.id;
        }
        this.match.matchResult = null;
        this.match.active = false;
    }

    /** The entrants in the order the committed result placed them. */
    entrantsByPlacement(): Entrant[] {
        const order = new Map(
            (this.match.matchResult?.playerPoints ?? []).map((entry, index) => [entry.playerId, index]),
        );

        return [...this.entrants].sort((left, right) =>
            (order.get(left.participants?.[0]?.player?.id) ?? Number.MAX_SAFE_INTEGER) -
            (order.get(right.participants?.[0]?.player?.id) ?? Number.MAX_SAFE_INTEGER),
        );
    }

    /**
     * The points a commit would write, or `null` while the match is still
     * waiting on somebody.
     *
     * A round played on a song waits for every player, because a missing score
     * is a run nobody entered. A hand-scored round waits for nobody in
     * particular: the points are stated, one to nothing is a result, and a
     * player nobody gave points to scored none.
     */
    /** Whether anybody has played or been given anything in this match. */
    private hasEvidence(): boolean {
        return this.rounds.some((round) =>
            (round.standings ?? []).some((standing) => Boolean(standing.score) || standing.points > 0),
        );
    }

    private calculatePoints(): Array<{ playerId: number; points: number }> | null {
        const playerIds = this.singlesPlayerIds();
        if (playerIds.length === 0 || this.rounds.length === 0) return null;

        const everyRoundSettled = this.rounds.every((round) =>
            round.song
                ? playerIds.every((playerId) =>
                    (round.standings ?? []).some((standing) => standing.player.id === playerId),
                )
                : (round.standings ?? []).some((standing) => standing.points > 0),
        );
        if (!everyRoundSettled) return null;

        const playerPoints = playerIds.map((playerId) => ({
            playerId,
            points: this.rounds.reduce((total, round) => {
                const standing = (round.standings ?? []).find((candidate) => candidate.player.id === playerId);

                return total + (standing?.points ?? 0);
            }, 0),
        }));

        return playerPoints;
    }

    private tiebreakPlacementInputs(): TiebreakPlacementInput[] {
        return this.tiebreaks.map((tiebreak) => ({
            id: tiebreak.id ?? 0,
            sequence: tiebreak.sequence,
            invalidated: tiebreak.invalidated,
            complete: this.isTiebreakComplete(tiebreak),
            entries: (tiebreak.standings ?? []).map((standing) => ({
                playerId: standing.player.id,
                value: tiebreak.song ? Number(standing.score?.percentage ?? 0) : standing.manualPoints ?? null,
                isFailed: tiebreak.song ? standing.score?.isFailed ?? null : null,
            })),
        }));
    }

    private outgoingAdvancementRules(): AdvancementRule[] {
        return this.advancementRules.filter((rule) => rule.sourceKind === 'match' && rule.sourceId === this.match.id);
    }

    /**
     * Whether an attempt has everything it is waiting for, under the rule its
     * rounds already follow.
     *
     * A played attempt waits for every player, because a missing score is a run
     * nobody entered. A hand-scored one waits for nobody in particular: the
     * values are stated, so the first point stated settles it and zero
     * everywhere means nothing has been stated yet. An attempt whose stated
     * values do not separate anybody is settled and resolves nothing, which
     * leaves the tie for the person who stated them to correct.
     */
    private isTiebreakComplete(tiebreak: MatchTiebreak): boolean {
        const standings = tiebreak.standings ?? [];
        if (standings.length < 2) return false;

        return tiebreak.song
            ? standings.every((standing) => Boolean(standing.score))
            : standings.some((standing) => (standing.manualPoints ?? 0) > 0);
    }

    private tiebreakOf(tiebreakId: number): MatchTiebreak {
        const tiebreak = this.tiebreaks.find((candidate) => candidate.id === tiebreakId);
        if (!tiebreak) throw new NotFoundException(`Tiebreak with id ${tiebreakId} not found in match ${this.match.id}`);

        return tiebreak;
    }

    private tiebreakStandingOf(tiebreak: MatchTiebreak, playerId: number): MatchTiebreakStanding {
        const standing = (tiebreak.standings ?? []).find((candidate) => candidate.player?.id === playerId);
        if (!standing) throw new BadRequestException(`Player ${playerId} does not participate in tiebreak ${tiebreak.id}`);

        return standing;
    }

    private invalidateTiebreaks(): void {
        this.tiebreaks.forEach((tiebreak) => {
            tiebreak.invalidated = true;
        });
    }

    private roundOf(roundId: number): Round {
        const round = this.rounds.find((candidate) => candidate.id === roundId);
        if (!round) throw new NotFoundException(`Round with id ${roundId} not found in match ${this.match.id}`);

        return round;
    }

    /** One standing per player per round, which is what the database enforces. */
    private writeStanding(round: Round, player: Player, score: Score | null, points: number): void {
        const existing = (round.standings ?? []).find((candidate) => candidate.player?.id === player.id);
        const standing = existing ?? new Standing();
        standing.player = player;
        standing.score = score;
        standing.points = points;

        if (!existing) round.standings = [...(round.standings ?? []), standing];
    }

    /**
     * Puts the rounds back in agreement with who is in the match.
     *
     * Whoever left takes their standings with them: a score is evidence of a run
     * by somebody in this match, and there is nobody left for it to belong to.
     * What remains is ranked again where the round is complete and set back to
     * zero where it is not, which is the rule `removeStanding` already applies
     * when a single score is taken away.
     *
     * A hand-scored round keeps its points. They were stated by a person rather
     * than computed from a field, so the only thing the change of field does to
     * them is remove the ones nobody owns.
     */
    private resettle(scoringSystems: ScoringSystemProvider): void {
        this.invalidateTiebreaks();
        const playerIds = new Set(this.singlesPlayerIds());

        this.rounds.forEach((round) => {
            round.standings = (round.standings ?? []).filter((standing) => {
                if (playerIds.has(standing.player?.id)) return true;
                if (standing.id) this.removedStandingIds.add(standing.id);

                return false;
            });

            if (!round.song) return;
            if (this.isRoundComplete(round)) this.rankIfComplete(round, scoringSystems);
            else round.standings.forEach((standing) => (standing.points = 0));
        });
    }

    private isRoundComplete(round: Round): boolean {
        const playerIds = this.singlesPlayerIds();
        if (playerIds.length === 0) return false;

        return playerIds.every((playerId) => (round.standings ?? []).some((standing) => standing.player.id === playerId));
    }

    private rankIfComplete(round: Round, scoringSystems: ScoringSystemProvider): void {
        if (!this.isRoundComplete(round)) return;

        const scoringSystem = scoringSystems.getScoringSystem(this.match.scoringSystem);
        if (!scoringSystem) throw new Error(`Unknown scoring system ${this.match.scoringSystem}`);

        /* A scoring system ranks percentages, so it is only ever handed the
           standings that have a score behind them. On a round with a song that
           is all of them. */
        scoringSystem.recalc(round.standings.filter(isPlayed));
    }

    private singlesPlayerIds(): number[] {
        return this.entrants
            .filter((entrant) => entrant.type === 'player')
            .map((entrant) => entrant.participants?.[0]?.player?.id)
            .filter((playerId): playerId is number => Number.isFinite(playerId));
    }
}
