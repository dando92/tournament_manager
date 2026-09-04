import {
  Entity,
  Index,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  ManyToMany,
  JoinTable,
  JoinColumn } from 'typeorm';
import type { ScoringSystemType } from '@tournament-manager/scoring';

import { Round } from './round.entity'
import { Entrant } from './entrant.entity'
import { MatchResult } from './match_result.entity'
import { PhaseGroup } from './phase-group.entity'
import { MatchTiebreak } from './match-tiebreak.entity'

/**
 * Where a match stands in its result lifecycle.
 *
 * `open` holds nothing anybody played, `partial` holds evidence that does not
 * settle it yet, `ready` can be committed as it is, `tiebreak_required` is
 * settled on points but tied where the tie decides where somebody goes, and
 * `completed` has its result written.
 *
 * The order is total: everything above `open` carries evidence, which is what
 * lets one column answer both "has this match progressed" and "is this match
 * waiting on a person". `active` says something else entirely — that a match is
 * on a cabinet now — and stays a column of its own.
 */
export type MatchState = 'open' | 'partial' | 'ready' | 'tiebreak_required' | 'completed';

@Entity()
@Index('IDX_match_phase_group', ['phaseGroup'])
export class Match {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  subtitle: string;

  @Column({ nullable: true })
  notes: string;

  @Column()
  scoringSystem: ScoringSystemType;

  @Column({ default: false })
  active: boolean;

  @Column({ default: 'open' })
  state: MatchState;

  @ManyToMany(() => Entrant, (entrant) => entrant.matches, { nullable: true })
  @JoinTable()
  entrants?: Entrant[];

  @OneToMany(() => Round, (round) => round.match, { cascade: true  })
  rounds: Round[];

  @OneToMany(() => MatchTiebreak, (tiebreak) => tiebreak.match, { cascade: true })
  tiebreaks: MatchTiebreak[];

  @OneToOne(() => MatchResult, (matchResult) => matchResult.match, {
    cascade: true,
    eager: true,
    nullable: true,
  })
  @JoinColumn()
  matchResult?: MatchResult | null;

  @ManyToOne(() => PhaseGroup, (phaseGroup) => phaseGroup.matches, { onDelete: 'CASCADE' })
  @JoinColumn()
  phaseGroup: PhaseGroup;
}
