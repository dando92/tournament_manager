import { ScoringSystemProvider } from '@tournament-manager/scoring';
import type { ScoringStanding, ScoringSystemType } from '@tournament-manager/scoring';

import { Profile } from './options';
import { Random } from './random';

/**
 * The tables this tool writes, in the order it writes them, with the columns
 * each row array carries.
 *
 * The order is the foreign key order, with one exception: `schedule` is written
 * before `schedule_entry` and its `currentEntryId` is filled in afterwards,
 * because the two reference each other.
 */
export const TABLES: Array<{ table: string; columns: string[] }> = [
    { table: 'player', columns: ['id', 'playerName'] },
    { table: 'setup', columns: ['id', 'name', 'cabinetName', 'position'] },
    {
        table: 'tournament',
        columns: ['id', 'name', 'status', 'closedAt', 'syncstartUrl', 'startggApiKey', 'availableSetupsCount', 'defaultScoringSystem'],
    },
    { table: 'song', columns: ['id', 'title', 'artist', 'group', 'difficulty', 'chartDifficulty', 'tournamentId'] },
    { table: 'participant', columns: ['id', 'roles', 'status', 'tournamentId', 'playerId', 'accountId'] },
    { table: 'division', columns: ['id', 'name', 'tournamentId'] },
    { table: 'entrant', columns: ['id', 'name', 'type', 'status', 'seedNum', 'divisionId'] },
    { table: 'entrant_participants_participant', columns: ['entrantId', 'participantId'] },
    { table: 'phase', columns: ['id', 'name', 'divisionId'] },
    { table: 'phase_group', columns: ['id', 'name', 'displayIdentifier', 'bracketType', 'state', 'phaseId'] },
    { table: 'phase_group_entrant', columns: ['id', 'seedNum', 'slot', 'status', 'phaseGroupId', 'entrantId', 'sourceAdvancementRuleId'] },
    { table: 'match_result', columns: ['id', 'playerPoints'] },
    { table: 'match', columns: ['id', 'name', 'subtitle', 'notes', 'scoringSystem', 'active', 'state', 'matchResultId', 'phaseGroupId'] },
    { table: 'match_entrants_entrant', columns: ['matchId', 'entrantId'] },
    { table: 'round', columns: ['id', 'matchId', 'songId'] },
    { table: 'score', columns: ['id', 'percentage', 'isFailed', 'songId', 'playerId'] },
    { table: 'standing', columns: ['id', 'points', 'scoreId', 'roundId', 'playerId'] },
    { table: 'match_tiebreak', columns: ['id', 'sequence', 'invalidated', 'matchId', 'songId'] },
    { table: 'match_tiebreak_standing', columns: ['id', 'tiebreakId', 'playerId', 'scoreId', 'manualPoints'] },
    { table: 'advancement_rule', columns: ['id', 'sourceKind', 'sourceId', 'sourcePlacement', 'targetKind', 'targetId', 'targetSlot'] },
    {
        table: 'schedule',
        columns: [
            'id',
            'name',
            'willStartAt',
            'status',
            'currentEntryId',
            'staleCode',
            'staleDetails',
            'interruptionCode',
            'interruptionDetails',
            'interruptedAt',
            'archivedAt',
            'version',
            'tournamentId',
        ],
    },
    { table: 'schedule_entry', columns: ['id', 'position', 'expectedDurationMinutes', 'startedAt', 'completedAt', 'scheduleId', 'matchId'] },
];

/** Every table above, with the id counter it draws from. */
export const ID_TABLES = TABLES.map(({ table }) => table).filter(
    (table) => table !== 'entrant_participants_participant' && table !== 'match_entrants_entrant',
);

/**
 * What the database already holds that a run has to build on top of.
 *
 * Every run appends unless it is told to reset, so this is what makes a second
 * run continue an installation instead of restating it: the tournaments already
 * there decide the next one's name and the generator's offset, the setups are
 * topped up rather than duplicated, and — when a run is extending one
 * tournament — its people, its songs and whether it already has a board
 * running are read rather than invented.
 */
export type ExistingState = {
    tournaments: number;
    setups: number;
    /** Players already there, so a run can enter the scene it finds. */
    players: number[];
    /** Present only when the run extends one tournament rather than adding one. */
    target: ExistingTournament | null;
};

export type ExistingTournament = {
    id: number;
    /** Everyone already entered, by player, so no second `participant` is written. */
    participants: Map<number, number>;
    songs: number[];
    hasRunningSchedule: boolean;
};

export type Dataset = {
    rows: Record<string, unknown[][]>;
    /** The `currentEntryId` of each running schedule, written after its entries. */
    currentEntries: Array<{ scheduleId: number; entryId: number }>;
    counts: Record<string, number>;
};

/**
 * How many people a run needs in front of it.
 *
 * `readExistingState` uses it too, to decide how many of the players already in
 * the database to read back for reuse, so the bound on that read and the size
 * of the field cannot come apart.
 */
export function poolSize(profile: Profile): number {
    const perTournament = profile.divisions * profile.entrantsPerDivision;
    const closedEntrants = profile.divisionsPerClosedTournament * profile.entrantsPerClosedDivision;

    return Math.max(Math.ceil(perTournament * 0.8), Math.ceil(perTournament * profile.tournaments * 0.4), closedEntrants, 2);
}

/** Where a match is meant to end up, which decides what is written into it. */
type MatchIntent = 'completed' | 'ready' | 'tiebreak_required' | 'partial' | 'open_with_rounds' | 'open_empty';

/**
 * The mix. An empty or uniform dataset measures nothing: it is the half-played
 * matches, the open tiebreaks and the ambiguous ties that make the expensive
 * branches run at all. Roughly half of every pool carries evidence and a sixth
 * of it is committed, which is what a tournament looks like at midday.
 */
const INTENT_MIX: ReadonlyArray<readonly [MatchIntent, number]> = [
    ['completed', 17],
    ['ready', 17],
    ['tiebreak_required', 4],
    ['partial', 16],
    ['open_with_rounds', 26],
    ['open_empty', 20],
];

const SONG_GROUPS = ['In The Groove', 'Fraxtil', 'Tachyon', 'Gpop', 'Cirque du Sordid', 'Waixing', 'Digital Dance'];
const CHART_DIFFICULTIES = ['Novice', 'Easy', 'Medium', 'Hard', 'Expert'];
const DIVISION_NAMES = ['Open', 'Amateur', 'Novice', 'Advanced', 'Expert', 'Rookie', 'Veteran', 'Wild'];

type EntrantSeat = { entrantId: number; playerId: number; seedNum: number };

/**
 * One player's line in a round, shaped the way the scoring systems read it: a
 * hand-scored standing has points and no score at all, which is exactly what
 * the schema allows and what `ScoringStanding` refuses, so those are never
 * handed to a calculator.
 */
type PlannedStanding = { playerId: number; points: number; score: { percentage: number; isFailed: boolean } | null };

/** A round on a song, or — when the song is null — the hand-scored one. */
type PlannedRound = { songId: number | null; standings: PlannedStanding[] };

type PlannedMatch = { matchId: number; intent: MatchIntent; hasRounds: boolean };

/**
 * Builds a whole database in memory, then hands it over to be written.
 *
 * Ids come from local counters seeded with the current maximum of each table,
 * so the graph can be built as arithmetic — a standing knows the id of its
 * score, its round and its player before any of the three is written — and the
 * sequences are moved past the block afterwards.
 *
 * What it does not write: team entrants, match assignments to cabinets, and
 * start.gg external mappings. Nothing in the read or write paths this exists to
 * measure touches any of the three.
 */
export class DatasetBuilder {
    private readonly rows: Record<string, unknown[][]> = Object.fromEntries(TABLES.map(({ table }) => [table, []]));
    private readonly matchRows = new Map<number, unknown[]>();
    private readonly currentEntries: Array<{ scheduleId: number; entryId: number }> = [];
    private readonly scoringSystems = new ScoringSystemProvider();

    constructor(
        private readonly profile: Profile,
        private readonly random: Random,
        private readonly tournamentName: string,
        private readonly ids: Record<string, () => number>,
        private readonly existing: ExistingState,
    ) {}

    build(): Dataset {
        const setups = this.buildSetups();

        if (this.existing.target) {
            this.extendTournament(this.existing.target);
        } else {
            const players = this.buildPlayers();
            for (let index = 0; index < this.profile.tournaments; index += 1) {
                this.buildOpenTournament(index, players, setups);
            }
            for (let index = 0; index < this.profile.closedTournaments; index += 1) {
                this.buildClosedTournament(index, players);
            }
        }

        return {
            rows: this.rows,
            currentEntries: this.currentEntries,
            counts: Object.fromEntries(TABLES.map(({ table }) => [table, this.rows[table].length])),
        };
    }

    /**
     * The field this run enters: people the database already holds, topped up
     * with new ones. The same competitors come back season after season, and a
     * participant row per tournament they entered is what the schema says about
     * that.
     *
     * Four fifths of the field is returning, so a run appended to an
     * installation joins the scene it finds instead of inventing another one. A
     * field of strangers every time would make `player` and `participant` grow
     * together, and a read that grows with the installation rather than with
     * the pool — the shape of item 19 — would stay invisible however many times
     * the seeder was run.
     *
     * Within one run, more tournaments means more people but far from
     * proportionally: each one seats its entrants from its own offset into the
     * pool, so consecutive tournaments share most of their field.
     */
    private buildPlayers(): number[] {
        const count = poolSize(this.profile);
        const returning = this.existing.players.slice(0, Math.floor(count * 0.8));

        return [...returning, ...this.createPlayers(count - returning.length)];
    }

    /**
     * New people, named after the id they were given. A run appends by default,
     * so a name derived from a per-run counter would repeat on the second run
     * and leave two `Player 0001` in a list somebody has to read.
     */
    private createPlayers(count: number): number[] {
        const ids: number[] = [];

        for (let index = 0; index < count; index += 1) {
            const id = this.ids.player();
            ids.push(id);
            this.rows.player.push([id, `Player ${String(id).padStart(5, '0')}`]);
        }

        return ids;
    }

    /**
     * Cabinets are global and shared, so a run tops the row up to the profile's
     * count rather than adding its own four every time.
     */
    private buildSetups(): number[] {
        const ids: number[] = [];

        for (let index = this.existing.setups; index < this.profile.setups; index += 1) {
            const id = this.ids.setup();
            ids.push(id);
            this.rows.setup.push([id, `Setup ${index + 1}`, `Cabinet ${index + 1}`, index + 1]);
        }

        return ids;
    }

    /** A tournament under way: structure, matches, evidence and schedules. */
    private buildOpenTournament(index: number, players: number[], setups: number[]): void {
        const tournamentId = this.ids.tournament();
        /* Numbered from what is already there, so a second run continues the
           series instead of writing a second "Dataset venue 1". */
        const sequence = this.existing.tournaments + index + 1;
        const name = sequence > 1 ? `${this.tournamentName} ${sequence}` : this.tournamentName;
        this.rows.tournament.push([tournamentId, name, 'open', null, '', null, this.profile.setups, 'PlacementPointsWithFailZero']);

        const songs = this.buildSongs(tournamentId, this.profile.songs);
        const participants = this.buildParticipants(tournamentId, players);
        const seatOffset = index * Math.ceil(this.profile.divisions * this.profile.entrantsPerDivision * 0.4);

        this.buildTournamentBody(tournamentId, players, participants, songs, seatOffset, true);
    }

    /**
     * More of a tournament that already exists: divisions, pools, matches and
     * boards added to what is there.
     *
     * Its people and its songs are read rather than invented, because a
     * participant is unique per person per tournament and a division added to a
     * live event is entered by the people who are already at it. New players
     * are created only to top the field up to what the profile's divisions
     * need.
     *
     * A second board is only started when nothing is running yet. Two boards
     * running at once is a thing the application allows and a venue does not
     * usually do, and a run that appends should not quietly decide otherwise.
     */
    private extendTournament(target: ExistingTournament): void {
        const needed = Math.max(Math.ceil(this.profile.divisions * this.profile.entrantsPerDivision * 0.8), 2);
        const entered = [...target.participants.keys()];
        const participants = new Map(target.participants);
        const created = this.createPlayers(Math.max(0, needed - entered.length));

        for (const playerId of created) {
            const id = this.ids.participant();
            participants.set(playerId, id);
            this.rows.participant.push([id, ['competitor'], 'checked_in', target.id, playerId, null]);
        }

        const players = [...entered, ...created];
        const songs = [...target.songs, ...this.buildSongs(target.id, Math.max(0, this.profile.songs - target.songs.length))];
        /* Offset by the divisions already there, so the new ones are not seated
           with exactly the field the old ones hold. */
        const seatOffset = this.random.int(0, Math.max(0, players.length - 1));

        this.buildTournamentBody(target.id, players, participants, songs, seatOffset, !target.hasRunningSchedule);
    }

    /** The divisions, competition and boards of one tournament, new or not. */
    private buildTournamentBody(
        tournamentId: number,
        players: number[],
        participants: Map<number, number>,
        songs: number[],
        seatOffset: number,
        allowRunning: boolean,
    ): void {
        const planned: PlannedMatch[] = [];

        for (let divisionIndex = 0; divisionIndex < this.profile.divisions; divisionIndex += 1) {
            const division = this.buildDivision(tournamentId, divisionIndex, players, participants, this.profile.entrantsPerDivision, seatOffset);
            planned.push(...this.buildCompetition(division.divisionId, division.seats, songs));
        }

        this.buildSchedules(tournamentId, planned, allowRunning);
    }

    /**
     * Archive weight: entrants and participants with no competition behind them.
     *
     * This is the shape that exposes a read growing with the installation's
     * history rather than with the pool being drawn, and it is invisible in a
     * database that holds one tournament.
     */
    private buildClosedTournament(index: number, players: number[]): void {
        const tournamentId = this.ids.tournament();
        this.rows.tournament.push([
            tournamentId,
            `${this.tournamentName} — Past Event ${index + 1}`,
            'closed',
            new Date(Date.UTC(2024, 0, 1 + index * 5)),
            '',
            null,
            2,
            'PlacementPointsWithFailZero',
        ]);

        const participants = this.buildParticipants(tournamentId, players);
        for (let divisionIndex = 0; divisionIndex < this.profile.divisionsPerClosedTournament; divisionIndex += 1) {
            this.buildDivision(tournamentId, divisionIndex, players, participants, this.profile.entrantsPerClosedDivision);
        }
    }

    private buildSongs(tournamentId: number, count: number): number[] {
        const ids: number[] = [];

        for (let index = 0; index < count; index += 1) {
            const id = this.ids.song();
            ids.push(id);
            this.rows.song.push([
                id,
                `Track ${String(id).padStart(5, '0')}`,
                `Artist ${this.random.int(1, 60)}`,
                this.random.pick(SONG_GROUPS),
                this.random.int(1, 20),
                this.random.pick(CHART_DIFFICULTIES),
                tournamentId,
            ]);
        }

        return ids;
    }

    /** One row per person who took part, which is what the unique index says. */
    private buildParticipants(tournamentId: number, players: number[]): Map<number, number> {
        const participants = new Map<number, number>();

        for (const playerId of players) {
            const id = this.ids.participant();
            participants.set(playerId, id);
            this.rows.participant.push([id, ['competitor'], 'checked_in', tournamentId, playerId, null]);
        }

        return participants;
    }

    /**
     * A division and its entrants.
     *
     * A player may enter more than one division of the same tournament, which
     * is why the entrant is what a match holds and the participant is what the
     * tournament holds. Inside one division everybody appears once, so no match
     * can seat the same person twice.
     */
    private buildDivision(
        tournamentId: number,
        divisionIndex: number,
        players: number[],
        participants: Map<number, number>,
        entrantCount: number,
        seatOffset = 0,
    ): { divisionId: number; seats: EntrantSeat[] } {
        const divisionId = this.ids.division();
        const name = DIVISION_NAMES[divisionIndex % DIVISION_NAMES.length];
        this.rows.division.push([divisionId, `${name} ${Math.floor(divisionIndex / DIVISION_NAMES.length) + 1}`, tournamentId]);

        const seats: EntrantSeat[] = [];
        for (let index = 0; index < entrantCount; index += 1) {
            const playerId = players[(seatOffset + divisionIndex * entrantCount + index) % players.length];
            const entrantId = this.ids.entrant();
            const seedNum = index + 1;
            seats.push({ entrantId, playerId, seedNum });
            this.rows.entrant.push([entrantId, `Entrant ${divisionIndex + 1}-${seedNum}`, 'player', 'active', seedNum, divisionId]);
            this.rows.entrant_participants_participant.push([entrantId, participants.get(playerId)]);
        }

        return { divisionId, seats };
    }

    /**
     * The phases, pools, matches and advancement of one division.
     *
     * Every pool chains its matches — the winner of one seats the next — and its
     * last match feeds a pool of the following phase. Those rules are not
     * decoration: whether a tied match is merely tied or is blocked on a
     * tiebreak depends on where its placements would send people, so a dataset
     * without advancement can never hold a `tiebreak_required` match.
     */
    private buildCompetition(divisionId: number, seats: EntrantSeat[], songs: number[]): PlannedMatch[] {
        const planned: PlannedMatch[] = [];
        let previousPools: number[] | null = null;

        for (let phaseIndex = 0; phaseIndex < this.profile.phasesPerDivision; phaseIndex += 1) {
            const phaseId = this.ids.phase();
            this.rows.phase.push([phaseId, phaseIndex === 0 ? 'Pools' : `Phase ${phaseIndex + 1}`, divisionId]);

            const pools: number[] = [];
            for (let poolIndex = 0; poolIndex < this.profile.poolsPerPhase; poolIndex += 1) {
                const phaseGroupId = this.ids.phase_group();
                const identifier = String.fromCharCode(65 + (poolIndex % 26));
                pools.push(phaseGroupId);
                this.rows.phase_group.push([
                    phaseGroupId,
                    `Pool ${identifier}`,
                    identifier,
                    'round_robin',
                    phaseIndex === 0 ? 'active' : 'pending',
                    phaseId,
                ]);

                const poolSeats = this.poolSeats(seats, poolIndex);
                this.seatPool(phaseGroupId, poolSeats);
                planned.push(...this.buildPoolMatches(phaseGroupId, identifier, poolSeats, songs, poolIndex, previousPools));
            }
            previousPools = pools;
        }

        return planned;
    }

    /**
     * The entrants of one pool, dealt round-robin so every pool of a phase is
     * roughly the same size and nobody is in two pools of the same phase.
     */
    private poolSeats(seats: EntrantSeat[], poolIndex: number): EntrantSeat[] {
        const dealt = seats.filter((_, index) => index % this.profile.poolsPerPhase === poolIndex);

        return dealt.length >= 2 ? dealt : seats.slice(0, 2);
    }

    private seatPool(phaseGroupId: number, seats: EntrantSeat[]): void {
        seats.forEach((seat, index) => {
            this.rows.phase_group_entrant.push([
                this.ids.phase_group_entrant(),
                seat.seedNum,
                index + 1,
                'active',
                phaseGroupId,
                seat.entrantId,
                null,
            ]);
        });
    }

    private buildPoolMatches(
        phaseGroupId: number,
        identifier: string,
        seats: EntrantSeat[],
        songs: number[],
        poolIndex: number,
        previousPools: number[] | null,
    ): PlannedMatch[] {
        const planned: PlannedMatch[] = [];
        const last = this.profile.matchesPerPool - 1;

        for (let index = 0; index <= last; index += 1) {
            /*
             * A tiebreak is only a tiebreak when a rule would send the tied
             * players apart. The last match of a pool has an outgoing rule only
             * when there is a later phase to send them to, so where there is
             * none the tie would simply be a tie, and the match is committed
             * instead. Writing `tiebreak_required` there would be a state the
             * aggregate does not agree with.
             */
            const hasOutgoingRule = index < last || previousPools !== null;
            const drawn = this.random.weighted(INTENT_MIX);
            const intent = drawn === 'tiebreak_required' && !hasOutgoingRule ? 'ready' : drawn;
            const size = intent === 'tiebreak_required' ? 2 : this.random.weighted([[2, 70] as const, [3, 25] as const, [4, 5] as const]);
            const matchSeats = this.random.sample(seats, Math.min(size, seats.length));

            planned.push(this.buildMatch(phaseGroupId, `Pool ${identifier} Match ${index + 1}`, intent, matchSeats, songs));
        }

        for (let index = 0; index < planned.length - 1; index += 1) {
            this.addRule(planned[index].matchId, 1, 'match', planned[index + 1].matchId, 1);
        }
        if (planned.length > 0 && previousPools) {
            this.addRule(planned[planned.length - 1].matchId, 1, 'phase_group', phaseGroupId, poolIndex + 1);
        }

        return planned;
    }

    private buildMatch(phaseGroupId: number, name: string, intent: MatchIntent, seats: EntrantSeat[], songs: number[]): PlannedMatch {
        const matchId = this.ids.match();
        /*
         * Round Winner awards one point and zero, which separates two people and
         * ties three, so it is only given to matches it can settle — and never
         * to a match that is meant to be tied, because it ranks by percentage
         * without noticing that two percentages are equal and would hand the
         * point to one of them.
         */
        const scoringSystem: ScoringSystemType =
            intent !== 'tiebreak_required' && seats.length === 2 && this.random.chance(0.08) ? 'RoundWinner' : 'PlacementPointsWithFailZero';
        const rounds = this.planRounds(intent, seats, songs, scoringSystem);
        let matchResultId: number | null = null;

        if (intent === 'completed') {
            matchResultId = this.ids.match_result();
            this.rows.match_result.push([matchResultId, JSON.stringify(this.resultEntries(rounds))]);
        }

        const row: unknown[] = [matchId, name, null, null, scoringSystem, false, this.stateOf(intent), matchResultId, phaseGroupId];
        this.rows.match.push(row);
        this.matchRows.set(matchId, row);
        for (const seat of seats) {
            this.rows.match_entrants_entrant.push([matchId, seat.entrantId]);
        }
        this.writeRounds(matchId, rounds);
        if (intent === 'tiebreak_required') {
            this.writeOpenTiebreak(matchId, seats, songs, rounds);
        }

        return { matchId, intent, hasRounds: rounds.length > 0 };
    }

    /** The column the aggregate would have written for this intent. */
    private stateOf(intent: MatchIntent): string {
        return intent === 'open_with_rounds' || intent === 'open_empty' ? 'open' : intent;
    }

    /**
     * What was played, and how far.
     *
     * `open_empty` has no rounds at all; `open_with_rounds` has songs chosen and
     * nothing played on them; `partial` is one run short of a settled round,
     * which is where a cabinet leaves a match between songs. The three settled
     * intents fill every round for every player and differ only in whether the
     * totals tie.
     *
     * One settled match in ten is scored by hand instead: a single round with no
     * song, carrying points somebody stated. It is the other half of the model
     * and it has its own unique index, so a dataset without it leaves both
     * untested.
     */
    private planRounds(intent: MatchIntent, seats: EntrantSeat[], songs: number[], scoringSystem: ScoringSystemType): PlannedRound[] {
        if (intent === 'open_empty') {
            return [];
        }

        const chosen = this.random.sample(songs, this.random.int(2, 3));
        if (intent === 'open_with_rounds') {
            return chosen.map((songId) => ({ songId, standings: [] }));
        }
        if (intent === 'partial') {
            const played = seats.slice(0, seats.length - 1);

            return chosen.map((songId, index) => ({
                songId,
                standings:
                    index > 0
                        ? []
                        : played.map((seat) => ({
                              playerId: seat.playerId,
                              points: 0,
                              score: { percentage: this.random.percentage(55, 99), isFailed: false },
                          })),
            }));
        }
        if (intent === 'tiebreak_required') {
            return this.tiedRounds(chosen, seats, scoringSystem);
        }
        if (this.random.chance(0.1)) {
            return [this.handScoredRound(seats)];
        }

        return this.separatedRounds(chosen, seats, scoringSystem);
    }

    /**
     * Rounds whose totals separate everybody.
     *
     * Distinct percentages inside a round are not enough: three players ranked
     * 3-1 and 1-3 across two rounds finish level, and a level finish under an
     * advancement rule is a `tiebreak_required` match rather than a `ready` one.
     * So the draw is checked and redrawn, and the fallback locks the ranking,
     * which cannot tie.
     */
    private separatedRounds(songs: number[], seats: EntrantSeat[], scoringSystem: ScoringSystemType): PlannedRound[] {
        for (let attempt = 0; attempt < 12; attempt += 1) {
            const rounds = songs.map((songId) => this.scoredRound(songId, seats, scoringSystem, false));
            if (this.totalsAreDistinct(rounds, seats)) {
                return rounds;
            }
        }

        return songs.map((songId) => this.scoredRound(songId, seats, scoringSystem, true));
    }

    /** Rounds nobody wins: identical evidence, and therefore identical points. */
    private tiedRounds(songs: number[], seats: EntrantSeat[], scoringSystem: ScoringSystemType): PlannedRound[] {
        return songs.map((songId) => {
            const percentage = this.random.percentage(70, 98);
            const standings = seats.map((seat) => ({ playerId: seat.playerId, points: 0, score: { percentage, isFailed: false } }));
            this.award(standings, scoringSystem);

            return { songId, standings };
        });
    }

    /**
     * One settled round.
     *
     * `ranked` gives player `i` the `i`-th percentage in every round, which
     * makes the totals distinct by construction — the escape hatch the draw
     * above falls back on. Otherwise the order is drawn, and one run in twelve
     * fails, because a failed run scores zero under the default system and that
     * is a branch worth exercising.
     */
    private scoredRound(songId: number, seats: EntrantSeat[], scoringSystem: ScoringSystemType, ranked: boolean): PlannedRound {
        const percentages = this.distinctPercentages(seats.length);
        const order = ranked ? seats : this.random.shuffle(seats);
        const failedIndex = !ranked && this.random.chance(0.08) ? this.random.int(0, seats.length - 1) : -1;
        const standings = order.map((seat, index) => ({
            playerId: seat.playerId,
            points: 0,
            score: { percentage: percentages[index], isFailed: index === failedIndex },
        }));
        this.award(standings, scoringSystem);

        return { songId, standings };
    }

    /**
     * The hand-scored round: points a person stated, with nothing played behind
     * them. Distinct and above zero, because zero everywhere means nobody has
     * stated anything yet and the match would be `open`.
     */
    private handScoredRound(seats: EntrantSeat[]): PlannedRound {
        return {
            songId: null,
            standings: seats.map((seat, index) => ({ playerId: seat.playerId, points: seats.length - index, score: null })),
        };
    }

    /** Percentages in descending order, far enough apart to stay distinct. */
    private distinctPercentages(count: number): number[] {
        const top = this.random.percentage(88, 99);

        return Array.from({ length: count }, (_, index) => Math.round((top - index * this.random.percentage(1.5, 6)) * 100) / 100);
    }

    /**
     * The points, from the calculation the application performs.
     *
     * Reimplementing the ranking here would make the dataset agree with a copy
     * of the rules rather than with the rules, which is the drift this whole
     * plan exists to remove. One of the systems sorts the array it is handed,
     * so it is handed a copy and the standings are read back through their own
     * objects.
     */
    private award(standings: PlannedStanding[], scoringSystem: ScoringSystemType): void {
        const system = this.scoringSystems.getScoringSystem(scoringSystem);
        if (!system) {
            throw new Error(`Unknown scoring system ${scoringSystem}`);
        }
        system.recalc(standings.filter((standing) => standing.score !== null) as ScoringStanding[]);
    }

    private totalsAreDistinct(rounds: PlannedRound[], seats: EntrantSeat[]): boolean {
        const totals = seats.map((seat) => this.totalOf(rounds, seat.playerId));

        return new Set(totals).size === totals.length;
    }

    private totalOf(rounds: PlannedRound[], playerId: number): number {
        return rounds.reduce((total, round) => total + (round.standings.find((standing) => standing.playerId === playerId)?.points ?? 0), 0);
    }

    /** The frozen result of a committed match, placements included. */
    private resultEntries(rounds: PlannedRound[]): Array<{ playerId: number; points: number; placement: number }> {
        const totals = new Map<number, number>();
        for (const round of rounds) {
            for (const standing of round.standings) {
                totals.set(standing.playerId, (totals.get(standing.playerId) ?? 0) + standing.points);
            }
        }

        return [...totals.entries()]
            .sort(([leftPlayer, leftPoints], [rightPlayer, rightPoints]) => rightPoints - leftPoints || leftPlayer - rightPlayer)
            .map(([playerId, points], index) => ({ playerId, points, placement: index + 1 }));
    }

    /**
     * The rounds, and the evidence in them. A played standing carries a score;
     * a hand-scored one carries points and nothing else, which is what lets a
     * standing exist without a score at all.
     */
    private writeRounds(matchId: number, rounds: PlannedRound[]): void {
        for (const round of rounds) {
            const roundId = this.ids.round();
            this.rows.round.push([roundId, matchId, round.songId]);

            for (const standing of round.standings) {
                let scoreId: number | null = null;
                if (standing.score) {
                    scoreId = this.ids.score();
                    this.rows.score.push([scoreId, standing.score.percentage, standing.score.isFailed, round.songId, standing.playerId]);
                }
                this.rows.standing.push([this.ids.standing(), standing.points, scoreId, roundId, standing.playerId]);
            }
        }
    }

    /**
     * An attempt nobody has played yet, which is what leaves the match waiting.
     *
     * A played attempt is complete only when every player has a score in it, so
     * standings with none keep the tie unresolved and the match in
     * `tiebreak_required` — the state an operator finds and has to act on.
     */
    private writeOpenTiebreak(matchId: number, seats: EntrantSeat[], songs: number[], rounds: PlannedRound[]): void {
        const used = new Set(rounds.map((round) => round.songId));
        const songId = songs.find((candidate) => !used.has(candidate)) ?? songs[0];
        const tiebreakId = this.ids.match_tiebreak();
        this.rows.match_tiebreak.push([tiebreakId, 1, false, matchId, songId]);

        for (const seat of seats) {
            this.rows.match_tiebreak_standing.push([this.ids.match_tiebreak_standing(), tiebreakId, seat.playerId, null, null]);
        }
    }

    private addRule(sourceId: number, sourcePlacement: number, targetKind: string, targetId: number, targetSlot: number): void {
        this.rows.advancement_rule.push([this.ids.advancement_rule(), 'match', sourceId, sourcePlacement, targetKind, targetId, targetSlot]);
    }

    /**
     * The schedules, one of which is running mid-course.
     *
     * That one is the profile's reason for existing: its earlier entries are
     * finished, its current entry is on a cabinet, and the entries after it are
     * waiting. A schedule that is merely `inactive` never exercises the runner,
     * and an empty board never exercises the page every spectator opens. One
     * board in four is archived, because the projection returns those too.
     *
     * `allowRunning` is false when the tournament already has a board running,
     * which is how a run that extends one adds boards without starting a second
     * event on the same cabinets.
     */
    private buildSchedules(tournamentId: number, planned: PlannedMatch[], allowRunning: boolean): void {
        const settled = planned.filter((match) => match.intent === 'completed');
        const startable = planned.filter((match) => (match.intent === 'partial' || match.intent === 'open_with_rounds') && match.hasRounds);
        const waiting = planned.filter((match) => match.intent !== 'completed');
        const taken = new Set<number>();
        const cursors = { settled: 0, startable: 0, waiting: 0 };

        const nextOf = (source: PlannedMatch[], key: keyof typeof cursors): PlannedMatch | null => {
            while (cursors[key] < source.length && taken.has(source[cursors[key]].matchId)) {
                cursors[key] += 1;
            }

            return cursors[key] < source.length ? source[cursors[key]++] : null;
        };

        for (let index = 0; index < this.profile.schedules; index += 1) {
            const scheduleId = this.ids.schedule();
            const running = allowRunning && index === 0;
            const archived = index % 4 === 3;
            const status = running ? 'running' : index % 4 === 1 ? 'completed' : 'inactive';
            const willStartAt = new Date(Date.UTC(2026, 8, 4, 9 + (index % 12), 0));
            this.rows.schedule.push([
                scheduleId,
                `${running ? 'Main Stage' : archived ? 'Archived Board' : 'Side Stage'} ${index + 1}`,
                willStartAt,
                status,
                null,
                null,
                null,
                null,
                null,
                null,
                archived ? new Date(Date.UTC(2026, 8, 3)) : null,
                1,
                tournamentId,
            ]);

            /* A third of a running board is behind it, one entry is on the
               cabinet, and the rest is ahead of it. */
            const finishedCount = running ? Math.floor(this.profile.entriesPerSchedule / 3) : 0;
            let currentEntryId: number | null = null;

            for (let position = 1; position <= this.profile.entriesPerSchedule; position += 1) {
                const finished = running && position <= finishedCount;
                const isCurrent = running && position === finishedCount + 1;
                const match = finished ? nextOf(settled, 'settled') : isCurrent ? nextOf(startable, 'startable') : nextOf(waiting, 'waiting');
                if (!match) {
                    break;
                }
                taken.add(match.matchId);

                const entryId = this.ids.schedule_entry();
                this.rows.schedule_entry.push([
                    entryId,
                    position,
                    this.random.int(15, 45),
                    finished || isCurrent ? willStartAt : null,
                    finished ? willStartAt : null,
                    scheduleId,
                    match.matchId,
                ]);

                if (isCurrent) {
                    currentEntryId = entryId;
                    this.activate(match.matchId);
                }
            }

            if (currentEntryId) {
                this.currentEntries.push({ scheduleId, entryId: currentEntryId });
            }
        }
    }

    /** The one match of the tournament that is on a cabinet right now. */
    private activate(matchId: number): void {
        const row = this.matchRows.get(matchId);
        if (row) {
            row[5] = true;
        }
    }
}
