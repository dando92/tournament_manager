import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";

import * as api from "@/features/control-room/api/control-room.api";
import { controlRoomKeys } from "@/features/control-room/api/control-room.keys";

export function useControlRoom(tournamentId: number) {
    const queryClient = useQueryClient();
    const flows = useQuery({
        queryKey: controlRoomKeys.all(tournamentId),
        queryFn: () => api.listFlows(tournamentId),
    });

    const mutate = useMutation({
        mutationFn: async (work: () => Promise<void>) => work(),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: controlRoomKeys.all(tournamentId) }),
        onError: (error) => {
            console.error("Control room command failed", error);
            toast.error("Unable to update the control room.");
        },
    });

    const run = (work: () => Promise<void>) => mutate.mutateAsync(work);
    const invalidate = () => queryClient.invalidateQueries({ queryKey: controlRoomKeys.all(tournamentId) });

    return {
        query: flows,
        flows: flows.data ?? [],
        pending: mutate.isPending,
        create: async (name: string) => {
            await api.createFlow(tournamentId, name);
            await invalidate();
        },
        rename: (flowId: number, name: string) => run(() => api.renameFlow(flowId, name)),
        remove: (flowId: number) => run(() => api.deleteFlow(flowId)),
        replaceEntries: (flowId: number, version: number, matchIds: number[]) => run(() => api.replaceEntries(flowId, version, matchIds)),
        start: (flowId: number) => run(() => api.startFlow(flowId)),
        pause: (flowId: number) => run(() => api.pauseFlow(flowId)),
        resume: (flowId: number) => run(() => api.resumeFlow(flowId)),
        stop: (flowId: number) => run(() => api.stopFlow(flowId)),
        archive: (flowId: number) => run(() => api.archiveFlow(flowId)),
        unarchive: (flowId: number) => run(() => api.unarchiveFlow(flowId)),
        startFrom: (flowId: number, entryId: number) => run(() => api.startFromEntry(flowId, entryId)),
    };
}

export function useManualMatchActivationAllowed(tournamentId?: number): boolean {
    const query = useQuery({
        queryKey: controlRoomKeys.all(tournamentId ?? 0),
        queryFn: () => api.listFlows(tournamentId ?? 0),
        enabled: Boolean(tournamentId),
    });

    return !(query.data ?? []).some((flow) => flow.status === "running" || flow.status === "paused");
}
