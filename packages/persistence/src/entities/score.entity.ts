import { Entity, Column, Index, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';

import { Song } from './song.entity';
import { Player } from './player.entity';

@Entity()
@Index('IDX_score_song_player_id', ['song', 'player', 'id'])
export class Score {
  @PrimaryGeneratedColumn()
  id: number;

  /* Two decimal places are authoritative — FQ-028 — and 100.00 needs five
     digits. */
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
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
