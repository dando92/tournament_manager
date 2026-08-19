import {
  Entity,
  Column,
  Check,
  Index,
  PrimaryGeneratedColumn,
  OneToMany,
} from 'typeorm';

import { Division } from './division.entity';
import { Song } from './song.entity';
import { Participant } from './participant.entity';

export type TournamentStatus = 'open' | 'closed';

@Entity()
@Check('CHK_tournament_status', `"status" IN ('open', 'closed')`)
@Index('IDX_tournament_retention', ['closedAt'], {
  where: `"status" = 'closed' AND "transportPurgedAt" IS NULL`,
})
export class Tournament {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'varchar', default: 'open' })
  status: TournamentStatus;

  @Column({ type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  transportPurgedAt: Date | null;

  @Column({ default: 'ws://syncservice.groovestats.com:1337' })
  syncstartUrl: string;

  @Column({ nullable: true, default: null })
  startggApiKey: string | null;

  @Column({ default: 2 })
  availableSetupsCount: number;

  @Column({ default: 'EurocupScoreCalculator' })
  defaultScoringSystem: string;

  @OneToMany(() => Division, (division) => division.tournament, { cascade: true })
  divisions: Division[]

  @OneToMany(() => Participant, (participant) => participant.tournament, { cascade: true })
  participants: Participant[];


  @OneToMany(() => Song, (song) => song.tournament, { eager: false })
  songs: Promise<Song[]>;
}
