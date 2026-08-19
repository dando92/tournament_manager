import { Entity, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';

import { Setup } from './setup.entity';
import { Round } from './round.entity';
import { Player } from './player.entity';


@Entity()
export class MatchAssignment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Player, (player) => player.matchAssignments, { onDelete: 'CASCADE' })
  player: Player;

  @ManyToOne(() => Round, (round) => round.matchAssignments, { onDelete: 'CASCADE' })
  round: Round;

  @ManyToOne(() => Setup, (setup) => setup.matchAssignments, { onDelete: 'CASCADE' })
  setup: Setup;
}

