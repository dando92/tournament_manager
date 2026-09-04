import type { ScoringSystemType } from '@tournament-manager/scoring';
import type { AdvancementCompetitionKind, EntrantType, MatchState } from './vocabulary';
import type { EntrantDto, PlayerRefDto, ScoreDto, SongRefDto } from './projections';

/**
 * The two shapes a match is read in.
 *
 * `MatchDto` is the Detail level: `GET /matches/:id` answers with it, and so do
 * the two list routes that have not yet been narrowed. `MatchSummaryDto` below
 * is the Summary level every list of matches reads. Both come out of the same
 * projection file, so a field cannot mean two things depending on which one
 * carried it.
 */

/**
 * The points of one player in one round. The score is the evidence behind them
 * and is absent on a hand-scored round, where the points were stated rather
 * than played.
 */
export type MatchStandingDto = {
    id: number;
    points: number;
    player: PlayerRefDto;
    score: ScoreDto | null;
};

/** A round with no song is the hand-scored one. A match holds at most one. */
export type MatchRoundDto = {
    id: number;
    song: SongRefDto | null;
    standings: MatchStandingDto[];
};

export type MatchResultEntryDto = {
    playerId: number;
    points: number;
    placement: number;
};

export type MatchTiebreakStandingDto = {
    id: number;
    player: PlayerRefDto;
    score: ScoreDto | null;
    manualPoints: number | null;
};

export type MatchTiebreakDto = {
    id: number;
    sequence: number;
    invalidated: boolean;
    song: SongRefDto | null;
    standings: MatchTiebreakStandingDto[];
};

export type MatchPlacementTieDto = {
    playerIds: number[];
    fromPlacement: number;
    toPlacement: number;
};

export type MatchResultStateDto = {
    status: 'incomplete' | 'tiebreak_required' | 'ready' | 'completed';
    entries: MatchResultEntryDto[];
    ambiguousTies: MatchPlacementTieDto[];
};

export type MatchResultDto = {
    id: number;
    playerPoints: MatchResultEntryDto[];
};

/**
 * Where an entrant comes from, or where the winner of a match goes next.
 *
 * The two names are the source's and the target's, resolved by the query that
 * reads the rule. They are names and not sentences: `Winner of Pool C R4` is
 * composed by whoever renders it, from the placement and the name, because a
 * rendered label in a shared contract is presentation no reader can reword.
 *
 * They are resolved here rather than by the client because a client can only
 * name what it has already loaded. That holds inside a pool, whose matches
 * arrive together, and fails on any view whose sources sit elsewhere in the
 * tournament — which is what made the schedule board read the whole tournament
 * to name four cards. Null when the rule points at a row that no longer exists.
 */
export type AdvancementRuleDto = {
    id: number;
    sourceKind: AdvancementCompetitionKind;
    sourceId: number;
    sourceName: string | null;
    sourcePlacement: number;
    targetKind: AdvancementCompetitionKind;
    targetId: number;
    targetName: string | null;
    targetSlot: number;
};

export type MatchDto = {
    id: number;
    name: string;
    subtitle: string;
    notes: string;
    scoringSystem: ScoringSystemType;
    active: boolean;
    state: MatchState;
    entrants: EntrantDto[];
    rounds: MatchRoundDto[];
    tiebreaks: MatchTiebreakDto[];
    advancementRules: AdvancementRuleDto[];
    resultState: MatchResultStateDto;
    matchResult?: MatchResultDto | null;
    phaseGroupId: number;
};

/** An entrant as a list names it: the player behind a singles slot, or nothing. */
export type MatchSummaryEntrantDto = {
    id: number;
    name: string;
    type: EntrantType;
    player: PlayerRefDto | null;
};

/**
 * A match as a list draws it.
 *
 * The Summary level of a match, in the sense `Backend.md` gives the word: who
 * is in it, where it stands, and what it is still waiting for, with its rounds,
 * standings, scores and tiebreaks reduced to the counts a row reads. Those
 * belong to `MatchDto`, which is the Detail level and is read one match at a
 * time by whatever opened it.
 *
 * It is owned by the match and not by any of its readers. The schedule board,
 * the unassigned picker of the Control Room and the timetable rows all read
 * this one shape, and a reader that needs another field adds it here for
 * everyone rather than growing a projection of its own.
 *
 * `missingScoreCount` counts the runs the rounds played on a song are still
 * waiting for. `tiebreakInProgress` is an attempt already on the table, which
 * is what tells a row waiting for a tiebreak from one whose tiebreak has been
 * opened. `winner` is resolved here because a row that has dropped the entrants
 * of a settled match can no longer name the player its result points at.
 */
export type MatchSummaryDto = {
    id: number;
    name: string;
    subtitle: string;
    active: boolean;
    state: MatchState;
    phaseGroupId: number;
    entrants: MatchSummaryEntrantDto[];
    /** The rules that feed this match, so a row can name the slots it is waiting for. */
    incomingRules: AdvancementRuleDto[];
    songCount: number;
    handScored: boolean;
    missingScoreCount: number;
    tiebreakInProgress: boolean;
    winner: PlayerRefDto | null;
};

/** `skipped` means the match is not linked to a start.gg set, so there was nothing to report. */
export type StartggReportStatus = 'reported' | 'skipped' | 'failed';

/**
 * What a commit answers.
 *
 * It carries no projection of the match: the committed match reaches the
 * interface through the events the command publishes, like every other write.
 * What is left is the outcome of an external side effect, which nobody else can
 * tell the caller about.
 */
export type CommitMatchResultResponseDto = {
    startggReport: StartggReportStatus;
};
