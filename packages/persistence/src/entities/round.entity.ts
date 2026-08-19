import { 
  Entity, 
  PrimaryGeneratedColumn, 
  ManyToOne, 
  OneToMany, 
  JoinColumn } from 'typeorm';

import { Match } from './match.entity'
import { Standing } from './standing.entity'
import { Song } from './song.entity'
import { MatchAssignment } from './match_assignment.entity';


@Entity()
export class Round {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToMany(() => Standing, (standing) => standing.round, { cascade: true })
  standings: Standing[]

  @ManyToOne(() => Match, (match) => match.rounds, { onDelete: 'CASCADE' })
  match: Match;

  @ManyToOne(() => Song, (song) => song.rounds, { onDelete: 'CASCADE' })
  song: Song;

  @OneToMany(() => MatchAssignment, (matchAssignment) => matchAssignment.round)
  matchAssignments: MatchAssignment[];
}
