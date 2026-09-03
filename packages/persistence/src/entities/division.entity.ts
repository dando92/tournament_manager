import {
  Entity,
  Index,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  ManyToOne,
  JoinColumn } from 'typeorm';

import { Phase } from './phase.entity';
import { Tournament } from './tournament.entity';
import { Entrant } from './entrant.entity';


@Entity()
@Index('IDX_division_tournament', ['tournament'])
export class Division {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  /**
   * How many times the shape of this division has changed.
   *
   * A structure plan records the version it was computed against and is refused
   * if it has moved, so a preview left open while somebody else edits cannot be
   * written against rows it never saw. Scores do not move it: a result is not a
   * change of shape.
   */
  @Column({ default: 0 })
  structureVersion: number;

  @OneToMany(() => Phase, (phase) => phase.division, { cascade: true })
  phases: Phase[];

  @OneToMany(() => Entrant, (entrant) => entrant.division, { cascade: true })
  entrants: Entrant[];

  @ManyToOne(() => Tournament, (tournament) => tournament.divisions, { onDelete: 'CASCADE' })
  @JoinColumn()
  tournament: Tournament;
}
