import type { PlayerRefDto } from './projections';

/** An account as it reads itself: the profile page and everything behind the session. */
export type AccountProfileDto = {
    id: string;
    username: string;
    grooveStatsApi: string;
    profilePicture: string;
    player: PlayerRefDto | null;
};

/** An account as the role administration page lists it. */
export type AdminAccountDto = {
    id: string;
    username: string;
    isAdmin: boolean;
    isTournamentCreator: boolean;
};

/** What the current session may do outside any one tournament. */
export type AccountPermissionsDto = {
    isAdmin: boolean;
    isTournamentCreator: boolean;
};
