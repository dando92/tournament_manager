import {
    AccountPermissionsDto,
    AccountProfileDto,
    AdminAccountDto,
} from '@tournament-manager/contracts';
import { Account } from '@tournament-manager/persistence';

export function accountProfile(account: Account): AccountProfileDto {
    return {
        id: account.id,
        username: account.username,
        nationality: account.nationality,
        grooveStatsApi: account.grooveStatsApi,
        profilePicture: account.profilePicture,
        player: account.player ?? null,
    };
}

export function adminAccount(account: Account): AdminAccountDto {
    return {
        id: account.id,
        username: account.username,
        isAdmin: account.isAdmin,
        isTournamentCreator: account.isTournamentCreator,
    };
}

export function accountPermissions(account: Pick<Account, 'isAdmin' | 'isTournamentCreator'> | null): AccountPermissionsDto {
    return {
        isAdmin: account?.isAdmin ?? false,
        isTournamentCreator: account?.isTournamentCreator ?? false,
    };
}
