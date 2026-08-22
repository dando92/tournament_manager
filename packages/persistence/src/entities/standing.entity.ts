import {
  Entity,
  Column,
  Index,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToOne,
  JoinColumn } from 'typeorm';

import { Score } from './score.entity'
import { Round } from './round.entity'
import { Player } from './player.entity'


/**
 * The points of one player in one round.
 *
 * The score is the evidence behind them and exists only when the round has a
 * song: a hand-scored round states its points directly, with nothing played
 * behind them. The player therefore belongs here rather than on the score,
 * which is what lets a standing exist without one.
 */
@Entity()
@Index(['round', 'player'], { unique: true })
export class Standing {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Score, { nullable: true })
  @JoinColumn()
  score?: Score | null

  @ManyToOne(() => Player, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn()
  player: Player;

  @Column()
  points: number;

  @ManyToOne(() => Round, (round) => round.standings, { onDelete: 'CASCADE' })
  round: Round
}
