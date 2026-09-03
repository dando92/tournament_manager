import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";

import * as api from "@/features/schedule/api/schedule.api";
import { scheduleKeys } from "@/features/schedule/api/schedule.keys";
import type { ScheduleEditorDto, ScheduleDto, ScheduleEntryInputDto } from "@tournament-manager/contracts";

export function useSchedules(tournamentId: number) {
    const queryClient = useQueryClient();
    const schedules = useQuery({
        queryKey: scheduleKeys.all(tournamentId),
        queryFn: () => api.listSchedules(tournamentId),
    });

    const mutate = useMutation({
        mutationFn: async (work: () => Promise<void>) => work(),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: scheduleKeys.all(tournamentId) }),
        onError: (error) => {
            console.error("Schedule command failed", error);
            toast.error("Unable to update the schedule.");
        },
    });

    const run = (work: () => Promise<void>) => mutate.mutateAsync(work);
    const invalidate = () => queryClient.invalidateQueries({ queryKey: scheduleKeys.all(tournamentId) });

    return {
        query: schedules,
        schedules: schedules.data ?? [],
        pending: mutate.isPending,
        create: async (input: { name: string; willStartAt: string; defaultExpectedDurationMinutes: number; matchIds: number[] }) => {
            await api.createSchedule(tournamentId, input);
            await Promise.all([
                invalidate(),
                queryClient.invalidateQueries({ queryKey: scheduleKeys.creation(tournamentId) }),
            ]);
        },
        update: (scheduleId: number, name: string, willStartAt: string) => run(() => api.updateSchedule(scheduleId, name, willStartAt)),
        remove: (scheduleId: number) => run(() => api.deleteSchedule(scheduleId)),
        replaceEntries: (scheduleId: number, version: number, entries: ScheduleEntryInputDto[]) => run(() => api.replaceEntries(scheduleId, version, entries)),
        updateEntryTime: async (scheduleId: number, entryId: number, expectedDurationMinutes: number) => {
            try {
                await api.updateEntryTime(scheduleId, entryId, expectedDurationMinutes);
                queryClient.setQueryData<ScheduleDto[]>(scheduleKeys.all(tournamentId), (current) =>
                    current?.map((schedule) => schedule.id === scheduleId
                        ? { ...schedule, entries: schedule.entries.map((entry) => entry.id === entryId ? { ...entry, expectedDurationMinutes } : entry) }
                        : schedule),
                );
                queryClient.setQueryData<ScheduleEditorDto>(scheduleKeys.editor(scheduleId), (current) => current
                    ? { ...current, schedule: { ...current.schedule, entries: current.schedule.entries.map((entry) => entry.id === entryId ? { ...entry, expectedDurationMinutes } : entry) } }
                    : current,
                );
            } catch (error) {
                console.error("Schedule timing update failed", error);
                toast.error("Unable to update the expected duration.");
                throw error;
            }
        },
        start: (scheduleId: number) => run(() => api.startSchedule(scheduleId)),
        pause: (scheduleId: number) => run(() => api.pauseSchedule(scheduleId)),
        resume: (scheduleId: number) => run(() => api.resumeSchedule(scheduleId)),
        stop: (scheduleId: number) => run(() => api.stopSchedule(scheduleId)),
        archive: (scheduleId: number) => run(() => api.archiveSchedule(scheduleId)),
        unarchive: (scheduleId: number) => run(() => api.unarchiveSchedule(scheduleId)),
        startFrom: (scheduleId: number, entryId: number) => run(() => api.startScheduleFromEntry(scheduleId, entryId)),
    };
}

export function useManualMatchActivationAllowed(tournamentId?: number): boolean {
    const query = useQuery({
        queryKey: scheduleKeys.all(tournamentId ?? 0),
        queryFn: () => api.listSchedules(tournamentId ?? 0),
        enabled: Boolean(tournamentId),
    });

    return !(query.data ?? []).some((schedule) => schedule.status === "running" || schedule.status === "paused");
}
