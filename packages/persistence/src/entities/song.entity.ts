import {
  Entity,
  Check,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  ManyToOne } from 'typeorm';

import { Score } from './score.entity'
import { Round } from './round.entity'
import { Tournament } from './tournament.entity'


/**
 * The difficulty slot a chart occupies, as StepMania names it.
 *
 * `Beginner` and `Challenge` are stored under the names a player reads on an
 * ITGmania cabinet, `Novice` and `Expert`; the importer translates them.
 */
export type ChartDifficulty = 'Novice' | 'Easy' | 'Medium' | 'Hard' | 'Expert' | 'Edit';

@Entity()
@Check('CHK_song_chart_difficulty', `"chartDifficulty" IN ('Novice', 'Easy', 'Medium', 'Hard', 'Expert', 'Edit')`)
export class Song {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ nullable: true })
  artist: string;

  @Column()
  group: string;

  /** The meter: how hard the chart is. */
  @Column()
  difficulty: number;

  /**
   * Which of the six slots the chart was written for. Null for a song added by
   * hand, which states a meter and nothing else.
   */
  @Column({ type: 'varchar', nullable: true })
  chartDifficulty: ChartDifficulty | null;

  @OneToMany(() => Score, (score) => score.song, { cascade: true })
  scores: Score[]

  @OneToMany(() => Round, (round) => round.song, { cascade: true })
  rounds: Round[]

  @ManyToOne(() => Tournament, (tournament) => tournament.songs, { nullable: true, onDelete: 'SET NULL', eager: false })
  tournament: Tournament | null
}
