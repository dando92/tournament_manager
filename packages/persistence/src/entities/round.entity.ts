import { 
  Entity, 
  Index,
  PrimaryGeneratedColumn, 
  ManyToOne, 
  OneToMany, 
  JoinColumn } from 'typeorm';

import { Match } from './match.entity'
import { Standing } from './standing.entity'
import { Song } from './song.entity'
import { MatchAssignment } from './match_assignment.entity';


/**
 * One unit of scoring inside a match.
 *
 * A round with a song is a played song, and its standings carry the scores the
 * cabinet reported. A round without a song is a stated result: its standings
 * carry points a person wrote and no score at all. A match holds at most one of
 * the second kind, and never the same song twice — both rules are unique
 * indexes rather than assumptions.
 */
@Entity()
@Index(['match', 'song'], { unique: true })
@Index(['match'], { unique: true, where: '"songId" IS NULL' })
export class Round {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToMany(() => Standing, (standing) => standing.round, { cascade: true })
  standings: Standing[]

  @ManyToOne(() => Match, (match) => match.rounds, { onDelete: 'CASCADE' })
  match: Match;

  @ManyToOne(() => Song, (song) => song.rounds, { onDelete: 'CASCADE', nullable: true })
  song?: Song | null;

  @OneToMany(() => MatchAssignment, (matchAssignment) => matchAssignment.round)
  matchAssignments: MatchAssignment[];
}
