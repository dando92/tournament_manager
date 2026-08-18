import { Account } from '@persistence/entities';

export class AccountProfileDto {
    id: string;
    username: string;
    nationality: string;
    grooveStatsApi: string;
    profilePicture: string;
    player: Account['player'] | null;
}
