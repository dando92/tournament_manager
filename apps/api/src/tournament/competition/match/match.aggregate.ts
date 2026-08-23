import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
    Entrant,
    Match,
    MatchResult,
    MatchResultEntry,
    PhaseGroup,
    Player,
    Round,
    Score,
    Song,
    Standing,
} from '@tournament-manager/persistence';
import type { ScoringSystemProvider, ScoringSystemType } from '@tournament-manager/scoring';

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
    matchResultId: number | null;
};

/**
 * The part of a match the pool's projection shows. A change to it is a change
 * to the tree, and a change to nothing else in it is not.
 */
export type MatchPoolState = {
    completed: boolean;
    awaitingCommit: boolean;
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
    private removedMatchResultId: number | null = null;

    private constructor(private readonly match: Match) {}

    /** Wraps a match the store has loaded. */
    static of(match: Match): MatchAggregate {
        return new MatchAggregate(match);
    }

    /** A match that does not exist yet. Saving it gives it an id. */
    static create(details: MatchDetails, phaseGroup: PhaseGroup, entrants: Entrant[]): MatchAggregate {
        const match = new Match();
        match.name = details.name;
        match.subtitle = details.subtitle;
        match.notes = details.notes;
        match.scoringSystem = details.scoringSystem;
        match.active = false;
        match.phaseGroup = phaseGroup;
        match.entrants = entrants;
        match.rounds = [];
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

    /**
     * What the tree draws about the pool this match sits in: how many of its
     * matches are waiting on a person, and how many are done.
     *
     * `TreeQueries.pendingMatchesInScope` counts a match as waiting under
     * exactly the rule `resultEntries` applies, so the two are the same
     * predicate written twice and must change together. A command compares this
     * before and after its change to know whether the pool's projection moved,
     * which is what decides whether an event addressed to the pool follows the
     * one addressed to the match.
     */
    get poolState(): MatchPoolState {
        return {
            completed: this.isCompleted,
            awaitingCommit: !this.isCompleted && this.resultEntries() !== null,
        };
    }

    get entrants(): Entrant[] {
        return this.match.entrants ?? [];
    }

    get rounds(): Round[] {
        return this.match.rounds ?? [];
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
            matchResultId: this.removedMatchResultId,
        };
    }

    /** Called by the store once the removals above have been performed. */
    settle(): void {
        this.removedRoundIds.clear();
        this.removedStandingIds.clear();
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
        const playerPoints = this.resultEntries();
        if (!playerPoints) {
            throw new BadRequestException(`Match ${this.match.id} cannot be completed because not all standings are populated`);
        }

        const result = this.match.matchResult ?? new MatchResult();
        result.playerPoints = playerPoints;
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
        const points = new Map(
            (this.match.matchResult?.playerPoints ?? []).map((entry) => [entry.playerId, entry.points]),
        );

        return [...this.entrants].sort((left, right) => {
            const leftPlayerId = left.participants?.[0]?.player?.id;
            const rightPlayerId = right.participants?.[0]?.player?.id;

            return (points.get(rightPlayerId) ?? 0) - (points.get(leftPlayerId) ?? 0);
        });
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
    private resultEntries(): MatchResultEntry[] | null {
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

        return playerPoints.sort((left, right) => right.points - left.points || left.playerId - right.playerId);
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
