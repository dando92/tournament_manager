import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";

import { Match } from "./match.entity";
import { MatchTiebreakStanding } from "./match-tiebreak-standing.entity";
import { Song } from "./song.entity";

/**
 * One attempt to split a tied placement group without changing match points.
 *
 * A song means the attempt is ranked by played percentages. No song means the
 * operator states ordering values by hand. Several attempts may follow one
 * another when an earlier attempt leaves part of its field tied.
 */
@Entity()
@Index("UQ_match_tiebreak_sequence", ["match", "sequence"], { unique: true })
export class MatchTiebreak {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    sequence: number;

    @Column({ default: false })
    invalidated: boolean;

    @ManyToOne(() => Match, (match) => match.tiebreaks, { nullable: false, onDelete: "CASCADE" })
    @JoinColumn({ name: "matchId", foreignKeyConstraintName: "FK_match_tiebreak_match" })
    match: Match;

    @ManyToOne(() => Song, { onDelete: "CASCADE", nullable: true })
    @JoinColumn({ name: "songId", foreignKeyConstraintName: "FK_match_tiebreak_song" })
    song?: Song | null;

    @OneToMany(() => MatchTiebreakStanding, (standing) => standing.tiebreak, { cascade: true })
    standings: MatchTiebreakStanding[];
}
