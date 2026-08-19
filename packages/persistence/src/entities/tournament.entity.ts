import {
  Entity,
  Column,
  Check,
  PrimaryGeneratedColumn,
  OneToMany,
} from 'typeorm';
import type { ScoringSystemType } from '@tournament-manager/scoring';

import { Division } from './division.entity';
import { Song } from './song.entity';
import { Participant } from './participant.entity';

export type TournamentStatus = 'open' | 'closed';

@Entity()
@Check('CHK_tournament_status', `"status" IN ('open', 'closed')`)
export class Tournament {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'varchar', default: 'open' })
  status: TournamentStatus;

  @Column({ type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  @Column({ default: 'ws://syncservice.groovestats.com:1337' })
  syncstartUrl: string;

  @Column({ nullable: true, default: null })
  startggApiKey: string | null;

  @Column({ default: 2 })
  availableSetupsCount: number;

  @Column({ default: 'EurocupScoreCalculator' })
  defaultScoringSystem: ScoringSystemType;

  @OneToMany(() => Division, (division) => division.tournament, { cascade: true })
  divisions: Division[]

  @OneToMany(() => Participant, (participant) => participant.tournament, { cascade: true })
  participants: Participant[];


  @OneToMany(() => Song, (song) => song.tournament, { eager: false })
  songs: Promise<Song[]>;
}
