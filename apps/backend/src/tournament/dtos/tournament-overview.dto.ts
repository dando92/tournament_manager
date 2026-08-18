export type TournamentOverviewDivisionPlayerDto = {
    id: number;
    playerName: string;
};

export type TournamentOverviewParticipantDto = {
    id: number;
    roles: string[];
    status: string;
    player: TournamentOverviewDivisionPlayerDto;
};

export type TournamentOverviewEntrantDto = {
    id: number;
    name: string;
    type: string;
    status: string;
    participants: TournamentOverviewParticipantDto[];
};

export type TournamentOverviewDivisionPhaseDto = {
    id: number;
    name: string;
    matchCount: number;
    phaseGroups: Array<{
        id: number;
        name: string;
        displayIdentifier: string | null;
        bracketType: string | null;
        state: string;
        entrants: unknown[];
        matchCount: number;
    }>;
};

export type TournamentOverviewDivisionDto = {
    id: number;
    name: string;
    entrants: TournamentOverviewEntrantDto[];
    phases: TournamentOverviewDivisionPhaseDto[];
};

export type TournamentOverviewDto = {
    divisionCount: number;
    playerCount: number;
    matchCount: number;
    divisions: TournamentOverviewDivisionDto[];
};
