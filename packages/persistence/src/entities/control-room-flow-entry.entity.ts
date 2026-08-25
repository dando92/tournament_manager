import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

import { Match } from "./match.entity";
import { ControlRoomFlow } from "./control-room-flow.entity";

@Entity()
@Index("UQ_control_room_flow_entry_position", ["flow", "position"], { unique: true })
@Index("UQ_control_room_flow_entry_match", ["match"], { unique: true })
export class ControlRoomFlowEntry {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    position: number;

    @Column({ type: "integer" })
    expectedDurationMinutes: number;

    @Column({ type: "timestamptz", nullable: true })
    startedAt: Date | null;

    @Column({ type: "timestamptz", nullable: true })
    completedAt: Date | null;

    @ManyToOne(() => ControlRoomFlow, (flow) => flow.entries, { onDelete: "CASCADE" })
    @JoinColumn({ name: "flowId", foreignKeyConstraintName: "FK_control_room_flow_entry_flow" })
    flow: ControlRoomFlow;

    @ManyToOne(() => Match, { onDelete: "CASCADE" })
    @JoinColumn({ name: "matchId", foreignKeyConstraintName: "FK_control_room_flow_entry_match" })
    match: Match;
}
