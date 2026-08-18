import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';

import { Song } from './song.entity';
import { Player } from './player.entity';

@Entity()
export class Score {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'decimal',
    transformer: {
      to: (value: number) => value,
      from: (value: string) => Number(value),
    },
  })
  percentage: number;

  @Column()
  isFailed: boolean;

  @ManyToOne(() => Song, (song) => song.scores, { onDelete: 'CASCADE' })
  song: Song;

  @ManyToOne(() => Player, (player) => player.scores, { onDelete: 'CASCADE' })
  player: Player;
}
