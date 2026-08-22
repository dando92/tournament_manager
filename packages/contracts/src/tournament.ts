import type { ScoringSystemType } from '@tournament-manager/scoring';
import type { DivisionSummaryDto } from './structure';
import type { TournamentStatus } from './vocabulary';

export type TournamentStaffDto = {
    id: string;
    username: string;
};

/** A tournament as every route outside the configuration page returns it. */
export type TournamentDto = {
    id: number;
    name: string;
    status: TournamentStatus;
    /** ISO-8601, or null while the tournament is open. */
    closedAt: string | null;
    syncstartUrl?: string;
    availableSetupsCount: number;
    defaultScoringSystem: ScoringSystemType;
    staff: TournamentStaffDto[];
};

/** What the configuration page edits, secrets included. Only its staff may read it. */
export type TournamentConfigurationDto = {
    id: number;
    name: string;
    status: TournamentStatus;
    /** ISO-8601, or null while the tournament is open. */
    closedAt: string | null;
    transportRetentionDays: number;
    syncstartUrl: string;
    startggApiKey?: string | null;
    availableSetupsCount: number;
    defaultScoringSystem: ScoringSystemType;
};

/**
 * The tournament as its sidebar tree reads it: every division with its phases
 * and pools, the counts rolled up, and no match.
 */
export type TournamentOverviewDto = {
    divisionCount: number;
    playerCount: number;
    matchCount: number;
    divisions: DivisionSummaryDto[];
};

/** What the current account may do, in this tournament and in general. */
export type MyTournamentRolesDto = {
    isAdmin: boolean;
    canCreateTournament: boolean;
    ownedTournamentIds: number[];
    staffTournamentIds: number[];
};
