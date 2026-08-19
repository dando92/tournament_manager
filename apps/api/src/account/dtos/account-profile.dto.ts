import { Account } from '@tournament-manager/persistence';

export class AccountProfileDto {
    id: string;
    username: string;
    nationality: string;
    grooveStatsApi: string;
    profilePicture: string;
    player: Account['player'] | null;
}
