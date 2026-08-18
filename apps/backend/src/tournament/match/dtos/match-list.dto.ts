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
    player: MatchListPlayerDto;
    song: MatchListSongDto;
};

export type MatchListStandingDto = {
    id: number;
    points: number;
    score: MatchListScoreDto;
};

export type MatchListRoundDto = {
    id: number;
    song: MatchListSongDto;
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
    scoringSystem: string;
    active: boolean;
    entrants: MatchListEntrantDto[];
    rounds: MatchListRoundDto[];
    advancementRules: MatchListAdvancementRuleDto[];
    matchResult?: MatchListResultDto | null;
    phaseGroupId: number;
};
