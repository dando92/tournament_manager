import { Check, Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, RelationId, VersionColumn } from "typeorm";

import { Tournament } from "./tournament.entity";
import { ControlRoomFlowEntry } from "./control-room-flow-entry.entity";

export type ControlRoomFlowStatus = "inactive" | "running" | "paused" | "completed";

@Entity()
@Check("CHK_control_room_flow_status", `"status" IN ('inactive', 'running', 'paused', 'completed')`)
@Index("IDX_control_room_flow_tournament", ["tournament"])
@Index("IDX_control_room_flow_current_entry", ["currentEntry"])
export class ControlRoomFlow {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @Column({ type: "timestamptz" })
    willStartAt: Date;

    @Column({ type: "varchar", default: "inactive" })
    status: ControlRoomFlowStatus;

    @Column({ nullable: true })
    currentEntryId: number | null;

    @ManyToOne(() => ControlRoomFlowEntry, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "currentEntryId", foreignKeyConstraintName: "FK_control_room_flow_current_entry" })
    currentEntry: ControlRoomFlowEntry | null;

    @Column({ type: "varchar", nullable: true })
    staleCode: string | null;

    @Column({ type: "jsonb", nullable: true })
    staleDetails: Record<string, unknown> | null;

    @Column({ type: "varchar", nullable: true })
    interruptionCode: string | null;

    @Column({ type: "jsonb", nullable: true })
    interruptionDetails: Record<string, unknown> | null;

    @Column({ type: "timestamptz", nullable: true })
    interruptedAt: Date | null;

    @Column({ type: "timestamptz", nullable: true })
    archivedAt: Date | null;

    @VersionColumn()
    version: number;

    @ManyToOne(() => Tournament, { onDelete: "CASCADE" })
    @JoinColumn({ name: "tournamentId", foreignKeyConstraintName: "FK_control_room_flow_tournament" })
    tournament: Tournament;

    @RelationId((flow: ControlRoomFlow) => flow.tournament)
    tournamentId: number;

    @OneToMany(() => ControlRoomFlowEntry, (entry) => entry.flow)
    entries: ControlRoomFlowEntry[];
}
