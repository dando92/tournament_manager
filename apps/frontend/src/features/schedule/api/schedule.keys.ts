export const scheduleKeys = {
    all: (tournamentId: number) => ["schedules", tournamentId] as const,
    creation: (tournamentId: number) => ["schedules", "creation", tournamentId] as const,
    editor: (scheduleId: number) => ["schedules", "editor", scheduleId] as const,
};
