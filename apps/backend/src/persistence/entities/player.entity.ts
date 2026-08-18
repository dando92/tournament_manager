import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  OneToOne } from 'typeorm';

import { Score } from './score.entity'
import { MatchAssignment } from './match_assignment.entity';
import { Account } from './account.entity';
import { Participant } from './participant.entity';

@Entity()
export class Player {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  playerName: string;

  @OneToOne(() => Account, (account) => account.player)
  account: Account;

  @OneToMany(() => Score, (score) => score.player, { cascade: true })
  scores: Score[];

  @OneToMany(() => Participant, (participant) => participant.player)
  participants: Participant[];

  @OneToMany(() => MatchAssignment, (matchAssignment) => matchAssignment.player)
  matchAssignments: MatchAssignment[];
}
