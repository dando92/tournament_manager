import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import type { StructurePlan } from "@tournament-manager/contracts";

import { applyStructurePlan } from "@/features/structure/api/structure-plan.api";
import { buildStructureCanvas, type CanvasMode, type CanvasSelection } from "@/features/structure/model/structureCanvas";
import { listByDivision } from "@/features/match/api/match.api";
import { matchKeys } from "@/features/match/api/match.keys";
import { tournamentKeys } from "@/features/tournament/api/tournament.keys";
import { useTournamentTree } from "@/features/tournament/model/TournamentTreeContext";
import { apiErrorMessage } from "@/shared/lib/apiError";
import type { TournamentDivisionOption } from "@/features/tournament/model/types";

/**
 * What the Structure page holds.
 *
 * The division, the mode and the selection live in the address bar, which is
 * what makes a view of a structure a thing you can send somebody: the back
 * button walks the selections you made, and a link opens on the phase you were
 * looking at rather than on the first one.
 *
 * The structure itself is the tree's own query. The page does not load a second
 * copy of it, so a pool renamed here changes in the sidebar without either of
 * them arranging it.
 */
export function useStructurePage(tournamentId: number, divisions: TournamentDivisionOption[]) {
    const queryClient = useQueryClient();
    const tree = useTournamentTree();
    const [params, setParams] = useSearchParams();
    const [error, setError] = useState<string | null>(null);
    const [applying, setApplying] = useState(false);

    const divisionId = Number(params.get("division")) || divisions[0]?.id || 0;
    const division = divisions.find((candidate) => candidate.id === divisionId);
    const mode: CanvasMode = params.get("mode") === "routes" ? "routes" : "build";

    const selection = readSelection(params.get("select"));

    /* The matches are read in both modes. Routing draws them, and building
       needs their rules anyway: a route out of a match is still a route out of
       the division, and it used to vanish from the canvas when the view changed
       rather than when the rule did. */
    const matches = useQuery({
        queryKey: matchKeys.byDivision(divisionId),
        enabled: divisionId > 0,
        queryFn: () => listByDivision(divisionId),
    });

    const canvas = useMemo(
        () => buildStructureCanvas({ division, matches: matches.data ?? [], mode, selection }),
        [division, matches.data, mode, selection],
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
            setError(apiErrorMessage(failure, "That change to the structure could not be saved."));

            return false;
        } finally {
            setApplying(false);
        }
    }

    return {
        division,
        divisionId,
        mode,
        selection,
        canvas,
        matches: matches.data ?? [],
        loadingMatches: matches.isLoading,
        applying,
        error,
        dismissError: () => setError(null),
        selectDivision: (id: number) => setParam("division", String(id)),
        setMode: (next: CanvasMode) => setParam("mode", next),
        select: (next: CanvasSelection) => setParam("select", next ? `${next.kind}:${next.id}` : null),
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
    if ((kind !== "pool" && kind !== "match") || !Number(id)) {
        return null;
    }

    return { kind, id: Number(id) };
}
