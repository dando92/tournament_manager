import { Column, Entity, Index, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn } from "typeorm";

import { MatchTiebreak } from "./match-tiebreak.entity";
import { Player } from "./player.entity";
import { Score } from "./score.entity";

/** One player's evidence in one tiebreak attempt. */
@Entity()
@Index(["tiebreak", "player"], { unique: true })
export class MatchTiebreakStanding {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => MatchTiebreak, (tiebreak) => tiebreak.standings, { onDelete: "CASCADE" })
    tiebreak: MatchTiebreak;

    @ManyToOne(() => Player, { onDelete: "CASCADE" })
    player: Player;

    @OneToOne(() => Score, { nullable: true })
    @JoinColumn()
    score?: Score | null;

    @Column({ nullable: true })
    manualPoints?: number | null;
}
