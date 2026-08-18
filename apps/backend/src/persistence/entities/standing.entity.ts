import { 
  Entity, 
  Column, 
  PrimaryGeneratedColumn, 
  ManyToOne, 
  OneToOne, 
  JoinColumn } from 'typeorm';

import { Score } from './score.entity'
import { Round } from './round.entity'


@Entity()
export class Standing {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Score)
  @JoinColumn()
  score: Score

  @Column()
  points: number;
  
  @ManyToOne(() => Round, (round) => round.standings, { onDelete: 'CASCADE' })
  round: Round
}
