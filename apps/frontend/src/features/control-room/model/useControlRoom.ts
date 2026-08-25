import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";

import * as api from "@/features/control-room/api/control-room.api";
import { controlRoomKeys } from "@/features/control-room/api/control-room.keys";
import type { ControlRoomEditorDto, ControlRoomFlowDto, ControlRoomFlowEntryInputDto } from "@tournament-manager/contracts";

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
        create: async (input: { name: string; willStartAt: string; defaultExpectedDurationMinutes: number; matchIds: number[] }) => {
            await api.createFlow(tournamentId, input);
            await Promise.all([
                invalidate(),
                queryClient.invalidateQueries({ queryKey: controlRoomKeys.creation(tournamentId) }),
            ]);
        },
        update: (flowId: number, name: string, willStartAt: string) => run(() => api.updateFlow(flowId, name, willStartAt)),
        remove: (flowId: number) => run(() => api.deleteFlow(flowId)),
        replaceEntries: (flowId: number, version: number, entries: ControlRoomFlowEntryInputDto[]) => run(() => api.replaceEntries(flowId, version, entries)),
        updateEntryTime: async (flowId: number, entryId: number, expectedDurationMinutes: number) => {
            try {
                await api.updateEntryTime(flowId, entryId, expectedDurationMinutes);
                queryClient.setQueryData<ControlRoomFlowDto[]>(controlRoomKeys.all(tournamentId), (current) =>
                    current?.map((flow) => flow.id === flowId
                        ? { ...flow, entries: flow.entries.map((entry) => entry.id === entryId ? { ...entry, expectedDurationMinutes } : entry) }
                        : flow),
                );
                queryClient.setQueryData<ControlRoomEditorDto>(controlRoomKeys.editor(flowId), (current) => current
                    ? { ...current, flow: { ...current.flow, entries: current.flow.entries.map((entry) => entry.id === entryId ? { ...entry, expectedDurationMinutes } : entry) } }
                    : current,
                );
            } catch (error) {
                console.error("Control room timing update failed", error);
                toast.error("Unable to update the expected duration.");
                throw error;
            }
        },
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
