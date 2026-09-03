/**
 * A plan somebody is building, kept on this device until it is applied.
 *
 * A generated bracket is not written until Create is pressed, so a reload in
 * the middle of choosing one used to lose the whole preview. What is stored is
 * the answers rather than the computed plan: recomputing them against the
 * division as it is now is also what keeps a restored draft honest, because a
 * plan drawn against a structure that has since moved would be a canvas
 * confidently showing links to rows that no longer exist.
 *
 * It is per device and per division, like every other preference here.
 */

const STORAGE_KEY = 'structure_plan_draft';

export type StructurePlanDraft = {
    tournamentId: number;
    divisionId: number;
    bracketType: string;
    phaseName: string;
    playerPerMatch: number;
};

export function readStructurePlanDraft(tournamentId: number, divisionId: number): StructurePlanDraft | null {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
            return null;
        }

        const draft = JSON.parse(stored) as StructurePlanDraft;

        return draft.tournamentId === tournamentId && draft.divisionId === divisionId ? draft : null;
    } catch {
        /* Storage can be unavailable or hold something else; the panel then opens empty. */
        return null;
    }
}

export function writeStructurePlanDraft(draft: StructurePlanDraft): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
        /* Storage can be unavailable or full; the draft then lasts for this page only. */
    }
}

export function clearStructurePlanDraft(): void {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch {
        /* Nothing to do: the draft was never stored. */
    }
}
