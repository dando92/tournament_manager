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

/** Where an entrant comes from, or where the winner of a match goes next. */
export type AdvancementRuleDto = {
    id: number;
    sourceKind: AdvancementCompetitionKind;
    sourceId: number;
    sourcePlacement: number;
    targetKind: AdvancementCompetitionKind;
    targetId: number;
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
