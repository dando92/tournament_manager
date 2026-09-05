import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import type { StructurePlan } from "@tournament-manager/contracts";

import { applyStructurePlan } from "@/features/structure/api/structure-plan.api";
import { buildStructureCanvas, poolKey, type CanvasSelection } from "@/features/structure/model/structureCanvas";
import {
    changeCount,
    emptyDraft,
    indexStructure,
    projectStructure,
    toStructurePlan,
    type StructureDraft,
} from "@/features/structure/model/structureDraft";
import { refsIn } from "@/features/structure/model/planReasons";
import { clearStructureDraft, readStructureDraft, writeStructureDraft } from "@/shared/lib/structureDraftStore";
import { listDivisionEntrants } from "@/features/division/api/division.api";
import { divisionKeys } from "@/features/division/api/division.keys";
import { listByDivision } from "@/features/match/api/match.api";
import { matchKeys } from "@/features/match/api/match.keys";
import { tournamentKeys } from "@/features/tournament/api/tournament.keys";
import { useTournamentTree } from "@/features/tournament/model/TournamentTreeContext";
import { apiErrorMessages } from "@/shared/lib/apiError";
import type { TournamentDivisionOption } from "@/features/tournament/model/types";

/**
 * What the Structure page holds.
 *
 * The division and the selection live in the address bar, which is what makes a
 * view of a structure a thing you can send somebody: the back button walks the
 * selections you made, and a link opens on the phase you were looking at rather
 * than on the first one. Folding does not: which pools somebody has shut is how
 * they are reading the page this minute, not what they are looking at.
 *
 * What is being built lives in a draft. Every gesture on the canvas edits it
 * and nothing on the page writes; the canvas draws the division as the draft
 * would leave it, and Commit sends the lot as one plan. The structure itself is
 * still the tree's own query, so a pool this page writes changes in the sidebar
 * without either of them arranging it.
 */
export function useStructurePage(tournamentId: number, divisions: TournamentDivisionOption[]) {
    const queryClient = useQueryClient();
    const tree = useTournamentTree();
    const [params, setParams] = useSearchParams();
    const [error, setError] = useState<string[] | null>(null);
    const [applying, setApplying] = useState(false);
    const [folded, setFolded] = useState<Set<string>>(new Set());

    const divisionId = Number(params.get("division")) || divisions[0]?.id || 0;
    const division = divisions.find((candidate) => candidate.id === divisionId);
    const structureVersion = division?.structureVersion ?? 0;

    const selection = readSelection(params.get("select"));

    const [draft, setDraft] = useState<StructureDraft>(() => readStructureDraft(tournamentId, divisionId) ?? emptyDraft(tournamentId, divisionId));

    /* A draft belongs to one division, so moving to another takes up whatever
       was left there and leaves this one where it was. */
    useEffect(() => {
        if (draft.tournamentId === tournamentId && draft.divisionId === divisionId) {
            return;
        }
        setDraft(readStructureDraft(tournamentId, divisionId) ?? emptyDraft(tournamentId, divisionId));
    }, [tournamentId, divisionId, draft.tournamentId, draft.divisionId]);

    useEffect(() => {
        if (changeCount(draft) > 0) {
            writeStructureDraft(draft);
        } else {
            clearStructureDraft(draft.tournamentId, draft.divisionId);
        }
    }, [draft]);

    /* The matches are read whether or not a pool is folded: a route out of a
       match is still a route out of the division, and it used to vanish from
       the canvas when the view changed rather than when the rule did. */
    const matches = useQuery({
        queryKey: matchKeys.byDivision(divisionId),
        enabled: divisionId > 0,
        queryFn: () => listByDivision(divisionId),
    });

    /* The roster is what a seat is chosen from, and also what a seat the draft
       has taken is drawn as: a match seated in the draft shows names. */
    const entrants = useQuery({
        queryKey: divisionKeys.entrants(divisionId),
        enabled: divisionId > 0,
        queryFn: () => listDivisionEntrants(divisionId),
    });

    const roster = useMemo(() => entrants.data ?? [], [entrants.data]);
    /* A reason names the node it is about, in the same `kind:id` the canvas
       keys its cards by, so the sentence and the card can be the same thing. */
    const faulted = useMemo(() => new Set((error ?? []).flatMap(refsIn)), [error]);
    const projected = useMemo(() => projectStructure(division, matches.data ?? [], draft, roster), [division, matches.data, draft, roster]);

    const canvas = useMemo(
        () => buildStructureCanvas({ division: projected.division, matches: projected.matches, selection, pending: projected.pending, folded, faulted }),
        [projected, selection, folded, faulted],
    );

    function setParam(key: string, value: string | null): void {
        setParams(
            (current) => {
                const next = new URLSearchParams(current);
                if (value === null) {
                    next.delete(key);
                } else {
                    next.set(key, value);
                }

                return next;
            },
            { replace: true },
        );
    }

    async function refresh(): Promise<void> {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: tournamentKeys.overview(tournamentId) }),
            queryClient.invalidateQueries({ queryKey: matchKeys.byDivision(divisionId) }),
            queryClient.invalidateQueries({ queryKey: divisionKeys.entrants(divisionId) }),
        ]);
    }

    /**
     * Applying is where a failure is reported, because it is where the action
     * was taken: the banner stays until it is closed rather than expiring over
     * a canvas the reader is still looking at.
     */
    async function apply(plan: StructurePlan): Promise<boolean> {
        setApplying(true);
        setError(null);
        try {
            await applyStructurePlan(tournamentId, plan);
            await refresh();

            return true;
        } catch (failure) {
            setError(apiErrorMessages(failure, "That change to the structure could not be saved."));

            return false;
        } finally {
            setApplying(false);
        }
    }

    /**
     * The whole draft, in one plan, in one transaction.
     *
     * The draft is only let go once the write has landed: a plan the applier
     * refused is still the work somebody did, and throwing it away because the
     * server said no is the one thing that would make this worse than writing
     * as you go.
     */
    async function commit(): Promise<boolean> {
        if (!division || changeCount(draft) === 0) {
            return true;
        }

        const tree = indexStructure(division, matches.data ?? [], draft);
        const written = await apply(toStructurePlan(draft, division.name, tree, structureVersion));
        if (written) {
            setDraft(emptyDraft(tournamentId, divisionId));
            select(null);
        }

        return written;
    }

    function select(next: CanvasSelection): void {
        setParam("select", next ? `${next.kind}:${next.id}` : null);
    }

    /** Folding one pool, and folding the lot, which is the header's own control. */
    function toggleFold(poolId: number): void {
        setFolded((current) => {
            const next = new Set(current);
            if (!next.delete(poolKey(poolId))) {
                next.add(poolKey(poolId));
            }

            return next;
        });
    }

    function foldAll(shut: boolean): void {
        const pools = (projected.division?.phases ?? []).flatMap((phase) => phase.phaseGroups ?? []);
        setFolded(shut ? new Set(pools.map((pool) => poolKey(pool.id))) : new Set());
    }

    return {
        division: projected.division,
        divisionId,
        selection,
        canvas,
        matches: projected.matches,
        roster,
        loadingMatches: matches.isLoading,
        applying,
        error,
        faulted,
        draft,
        changes: changeCount(draft),
        folded,
        toggleFold,
        foldAll,
        edit: (next: (current: StructureDraft) => StructureDraft) => setDraft(next),
        commit,
        discard: () => setDraft(emptyDraft(tournamentId, divisionId)),
        dismissError: () => setError(null),
        selectDivision: (id: number) => setParam("division", String(id)),
        select,
        apply,
        refresh,
        tree,
    };
}

function readSelection(raw: string | null): CanvasSelection {
    if (!raw) {
        return null;
    }
    const [kind, id] = raw.split(":");
    if ((kind !== "pool" && kind !== "match" && kind !== "phase") || !Number(id)) {
        return null;
    }

    return { kind, id: Number(id) };
}
