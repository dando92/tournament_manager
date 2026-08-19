import {
  Column,
  Entity,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Match } from './match.entity';

export type MatchResultEntry = {
  playerId: number;
  points: number;
};

@Entity()
export class MatchResult {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'simple-json' })
  playerPoints: MatchResultEntry[];

  @OneToOne(() => Match, (match) => match.matchResult, { onDelete: 'CASCADE' })
  match: Match;
}
