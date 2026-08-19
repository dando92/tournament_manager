import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  ManyToOne } from 'typeorm';

import { Score } from './score.entity'
import { Round } from './round.entity'
import { Tournament } from './tournament.entity'


@Entity()
export class Song {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ nullable: true })
  artist: string;

  @Column()
  group: string;

  @Column()
  difficulty: number;

  @OneToMany(() => Score, (score) => score.song, { cascade: true })
  scores: Score[]

  @OneToMany(() => Round, (round) => round.song, { cascade: true })
  rounds: Round[]

  @ManyToOne(() => Tournament, (tournament) => tournament.songs, { nullable: true, onDelete: 'SET NULL', eager: false })
  tournament: Tournament | null
}
