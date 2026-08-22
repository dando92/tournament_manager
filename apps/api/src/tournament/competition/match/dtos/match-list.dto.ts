export type MatchListSongDto = {
    id: number;
    title: string;
};

export type MatchListPlayerDto = {
    id: number;
    playerName: string;
};

export type MatchListParticipantDto = {
    id: number;
    roles: string[];
    status: string;
    player: MatchListPlayerDto;
};

export type MatchListEntrantDto = {
    id: number;
    name: string;
    type: string;
    status: string;
    participants: MatchListParticipantDto[];
};

export type MatchListScoreDto = {
    id: number;
    percentage: number;
    isFailed: boolean;
};

/**
 * The points of one player in one round. The score is the evidence behind them
 * and is absent on a hand-scored round, where the points were stated rather
 * than played.
 */
export type MatchListStandingDto = {
    id: number;
    points: number;
    player: MatchListPlayerDto;
    score: MatchListScoreDto | null;
};

/** A round with no song is the hand-scored one. A match holds at most one. */
export type MatchListRoundDto = {
    id: number;
    song: MatchListSongDto | null;
    standings: MatchListStandingDto[];
};

export type MatchListResultEntryDto = {
    playerId: number;
    points: number;
};

export type MatchListResultDto = {
    id: number;
    playerPoints: MatchListResultEntryDto[];
};

export type MatchListAdvancementRuleDto = {
    id: number;
    sourceKind: string;
    sourceId: number;
    sourcePlacement: number;
    targetKind: string;
    targetId: number;
    targetSlot: number;
};

export type MatchListDto = {
    id: number;
    name: string;
    subtitle: string;
    notes: string;
    scoringSystem: ScoringSystemType;
    active: boolean;
    entrants: MatchListEntrantDto[];
    rounds: MatchListRoundDto[];
    advancementRules: MatchListAdvancementRuleDto[];
    matchResult?: MatchListResultDto | null;
    phaseGroupId: number;
};
import type { ScoringSystemType } from '@tournament-manager/scoring';
