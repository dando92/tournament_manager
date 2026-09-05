import {
  Entity,
  Check,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  OneToOne } from 'typeorm';

import { Score } from './score.entity'
import { MatchAssignment } from './match_assignment.entity';
import { Account } from './account.entity';
import { Participant } from './participant.entity';

@Entity()
@Check('CHK_player_nationality', `"nationality" = '' OR "nationality" ~ '^[A-Z]{2}$'`)
export class Player {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  playerName: string;

  /* ISO 3166-1 alpha-2, upper case, which is what a flag is keyed by. Empty
     means unknown, and unknown is the common case: a walk-up competitor is a
     player with no account and nobody to ask. */
  @Column({ type: 'varchar', length: 2, default: '' })
  nationality: string;

  @OneToOne(() => Account, (account) => account.player)
  account: Account;

  @OneToMany(() => Score, (score) => score.player, { cascade: true })
  scores: Score[];

  @OneToMany(() => Participant, (participant) => participant.player)
  participants: Participant[];

  @OneToMany(() => MatchAssignment, (matchAssignment) => matchAssignment.player)
  matchAssignments: MatchAssignment[];
}
