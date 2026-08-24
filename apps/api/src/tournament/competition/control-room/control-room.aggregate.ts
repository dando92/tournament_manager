import { ConflictException } from "@nestjs/common";
import { ControlRoomFlow, ControlRoomFlowEntry, Tournament } from "@tournament-manager/persistence";
import type { ControlRoomInterruptionCode, ControlRoomStaleCode, ControlRoomStaleDetails } from "@tournament-manager/contracts";

export class ControlRoomAggregate {
    private constructor(private readonly flow: ControlRoomFlow) {}

    static of(flow: ControlRoomFlow): ControlRoomAggregate {
        return new ControlRoomAggregate(flow);
    }

    static create(name: string, tournament: Tournament): ControlRoomAggregate {
        const flow = new ControlRoomFlow();
        flow.name = name.trim();
        flow.status = "inactive";
        flow.currentEntryId = null;
        flow.staleCode = null;
        flow.staleDetails = null;
        flow.interruptionCode = null;
        flow.interruptionDetails = null;
        flow.interruptedAt = null;
        flow.archivedAt = null;
        flow.tournament = tournament;
        flow.entries = [];

        return new ControlRoomAggregate(flow);
    }

    get id(): number {
        return this.flow.id;
    }

    get entity(): ControlRoomFlow {
        return this.flow;
    }

    get tournamentId(): number {
        return this.flow.tournament?.id;
    }

    get status() {
        return this.flow.status;
    }

    get currentEntryId(): number | null {
        return this.flow.currentEntryId;
    }

    get entries(): ControlRoomFlowEntry[] {
        return [...(this.flow.entries ?? [])].sort((left, right) => left.position - right.position);
    }

    assertEditable(): void {
        if (this.flow.status !== "inactive" || this.flow.archivedAt) {
            throw new ConflictException(`Control room flow ${this.flow.id} is not editable`);
        }
    }

    rename(name: string): void {
        this.assertEditable();
        this.flow.name = name.trim();
    }

    start(entryId?: number): void {
        this.assertEditable();
        if (entryId !== undefined && !this.entries.some((entry) => entry.id === entryId)) {
            throw new ConflictException(`Entry ${entryId} does not belong to control room flow ${this.flow.id}`);
        }
        this.flow.currentEntryId = entryId ?? this.flow.currentEntryId;
        this.flow.status = "running";
        this.clearStale();
        this.clearInterruption();
    }

    pause(): void {
        if (this.flow.status !== "running") {
            throw new ConflictException(`Control room flow ${this.flow.id} is not running`);
        }
        this.flow.status = "paused";
    }

    resume(): void {
        if (this.flow.status !== "paused") {
            throw new ConflictException(`Control room flow ${this.flow.id} is not paused`);
        }
        this.flow.status = "running";
        this.clearStale();
    }

    stop(interruptionCode?: ControlRoomInterruptionCode, interruptionDetails?: Record<string, unknown>): void {
        if (this.flow.status !== "running" && this.flow.status !== "paused") {
            throw new ConflictException(`Control room flow ${this.flow.id} is not running or paused`);
        }
        this.flow.status = "inactive";
        this.clearStale();
        if (interruptionCode) {
            this.interrupt(interruptionCode, interruptionDetails);
        } else {
            this.clearInterruption();
        }
    }

    interruptCompletedRun(entryId: number, interruptionCode: ControlRoomInterruptionCode, interruptionDetails?: Record<string, unknown>): void {
        if (this.flow.status !== "completed") {
            throw new ConflictException(`Control room flow ${this.flow.id} is not completed`);
        }
        this.flow.status = "inactive";
        this.flow.currentEntryId = entryId;
        this.flow.archivedAt = null;
        this.clearStale();
        this.interrupt(interruptionCode, interruptionDetails);
    }

    waitAt(entryId: number, code: ControlRoomStaleCode, details: ControlRoomStaleDetails): void {
        this.flow.currentEntryId = entryId;
        this.flow.staleCode = code;
        this.flow.staleDetails = details;
    }

    activate(entryId: number): void {
        this.flow.currentEntryId = entryId;
        this.clearStale();
    }

    complete(): void {
        this.flow.status = "completed";
        this.flow.currentEntryId = null;
        this.clearStale();
    }

    archive(): void {
        if (this.flow.status !== "completed") {
            throw new ConflictException(`Only completed control room flows can be archived`);
        }
        this.flow.archivedAt = new Date();
    }

    unarchive(): void {
        if (this.flow.status !== "completed") {
            throw new ConflictException(`Only completed control room flows can be unarchived`);
        }
        this.flow.archivedAt = null;
    }

    replaceEntries(entries: ControlRoomFlowEntry[]): void {
        this.assertEditable();
        this.flow.entries = entries;
        if (this.flow.currentEntryId && !entries.some((entry) => entry.id === this.flow.currentEntryId)) {
            this.flow.currentEntryId = null;
        }
    }

    private clearStale(): void {
        this.flow.staleCode = null;
        this.flow.staleDetails = null;
    }

    private interrupt(code: ControlRoomInterruptionCode, details?: Record<string, unknown>): void {
        this.flow.interruptionCode = code;
        this.flow.interruptionDetails = details ?? null;
        this.flow.interruptedAt = new Date();
    }

    private clearInterruption(): void {
        this.flow.interruptionCode = null;
        this.flow.interruptionDetails = null;
        this.flow.interruptedAt = null;
    }
}
