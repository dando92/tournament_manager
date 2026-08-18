export interface Account {
  id: string;
  username: string;
  grooveStatsApi?: string;
  nationality?: string;
  profilePicture?: string;
  player?: { id: number; playerName: string };
}

export interface AdminAccount {
  id: string;
  username: string;
  isAdmin: boolean;
  isTournamentCreator: boolean;
}
