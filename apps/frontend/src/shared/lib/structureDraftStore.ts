import { emptyDraft, type StructureDraft } from "@/features/structure/model/structureDraft";

/**
 * A structure somebody is part way through building, kept on this device.
 *
 * Nothing is written until Commit, so a reload in the middle of laying out a
 * division would otherwise lose all of it. It is per device and per division,
 * like every other preference here.
 *
 * Per division is the key and not a filter. One shared key meant that opening
 * another division read nothing, wrote nothing, and then cleared the entry —
 * so glancing at the next division threw away the work in this one. Each
 * division now has an entry of its own, and none of them touches another.
 *
 * Whether the structure has moved underneath it is not asked here. The applier
 * refuses a plan whose basis has moved and says so, which is the one place that
 * can answer it truthfully; a draft is offered back and stands or falls there.
 */

const STORAGE_PREFIX = "structure_draft";

function keyOf(tournamentId: number, divisionId: number): string {
    return `${STORAGE_PREFIX}:${tournamentId}:${divisionId}`;
}

export function readStructureDraft(tournamentId: number, divisionId: number): StructureDraft | null {
    try {
        const stored = localStorage.getItem(keyOf(tournamentId, divisionId));
        if (!stored) {
            return null;
        }

        const draft = JSON.parse(stored) as StructureDraft;
        if (draft.tournamentId !== tournamentId || draft.divisionId !== divisionId) {
            return null;
        }

        /* An entry written before a draft could hold something is still a draft:
           what it does not carry is empty rather than missing. */
        return { ...emptyDraft(tournamentId, divisionId), ...draft };
    } catch {
        /* Storage can be unavailable or hold something else; the page then opens
           on the structure as it is, which is never wrong, only forgetful. */
        return null;
    }
}

export function writeStructureDraft(draft: StructureDraft): void {
    try {
        localStorage.setItem(keyOf(draft.tournamentId, draft.divisionId), JSON.stringify(draft));
    } catch {
        /* Storage can be unavailable or full; the draft then lasts for this page only. */
    }
}

export function clearStructureDraft(tournamentId: number, divisionId: number): void {
    try {
        localStorage.removeItem(keyOf(tournamentId, divisionId));
    } catch {
        /* Nothing to do: the draft was never stored. */
    }
}
