import type { StructureDraft } from "@/features/structure/model/structureDraft";

/**
 * A structure somebody is part way through building, kept on this device.
 *
 * Nothing is written until Commit, so a reload in the middle of laying out a
 * division would otherwise lose all of it. It is per device and per division,
 * like every other preference here.
 *
 * Whether the structure has moved underneath it is not asked here. The applier
 * refuses a plan whose basis has moved and says so, which is the one place that
 * can answer it truthfully; a draft is offered back and stands or falls there.
 */

const STORAGE_KEY = "structure_draft";

export function readStructureDraft(tournamentId: number, divisionId: number): StructureDraft | null {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
            return null;
        }

        const draft = JSON.parse(stored) as StructureDraft;

        return draft.tournamentId === tournamentId && draft.divisionId === divisionId ? draft : null;
    } catch {
        /* Storage can be unavailable or hold something else; the page then opens
           on the structure as it is, which is never wrong, only forgetful. */
        return null;
    }
}

export function writeStructureDraft(draft: StructureDraft): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
        /* Storage can be unavailable or full; the draft then lasts for this page only. */
    }
}

export function clearStructureDraft(): void {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch {
        /* Nothing to do: the draft was never stored. */
    }
}
