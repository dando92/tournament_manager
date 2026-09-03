import type { ScoringSystemType } from '@tournament-manager/scoring';
import type { AdvancementCompetitionKind } from './vocabulary';
import type { EntrantDto, PlayerRefDto, ScoreDto, SongRefDto } from './projections';

/**
 * The one shape a match is read in.
 *
 * `GET /matches/:id`, the two list routes and every mutation that answers with
 * a match return this, because they all go through the same projection.
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
    entrants: EntrantDto[];
    rounds: MatchRoundDto[];
    tiebreaks: MatchTiebreakDto[];
    advancementRules: AdvancementRuleDto[];
    resultState: MatchResultStateDto;
    matchResult?: MatchResultDto | null;
    phaseGroupId: number;
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
