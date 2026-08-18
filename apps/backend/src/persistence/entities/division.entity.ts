import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  ManyToOne,
  JoinColumn } from 'typeorm';

import { Phase } from './phase.entity';
import { Tournament } from './tournament.entity';
import { Entrant } from './entrant.entity';


@Entity()
export class Division {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @OneToMany(() => Phase, (phase) => phase.division, { cascade: true })
  phases: Phase[];

  @OneToMany(() => Entrant, (entrant) => entrant.division, { cascade: true })
  entrants: Entrant[];

  @ManyToOne(() => Tournament, (tournament) => tournament.divisions, { onDelete: 'CASCADE' })
  @JoinColumn()
  tournament: Tournament;
}
