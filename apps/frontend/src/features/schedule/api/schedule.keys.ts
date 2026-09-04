/**
 * The boards of a tournament, and the two counts that save reading them.
 *
 * `all` is a prefix, and only a prefix: nothing is read under it. A mutation
 * invalidates it to reach both lists at once, but the update listener matches
 * keys exactly, so an event names them through `lists`. `activity` sits outside
 * the prefix deliberately — it is answered by its own route, and a schedule
 * that starts publishes its own event.
 */
export const scheduleKeys = {
    all: (tournamentId: number) => ["schedules", tournamentId] as const,
    list: (tournamentId: number, archived: boolean) => ["schedules", tournamentId, archived ? "archived" : "live"] as const,
    /** Both boards lists, for a caller that has to name the keys it makes stale. */
    lists: (tournamentId: number) => [scheduleKeys.list(tournamentId, false), scheduleKeys.list(tournamentId, true)],
    activity: (tournamentId: number) => ["schedule-activity", tournamentId] as const,
    creation: (tournamentId: number) => ["schedules", "creation", tournamentId] as const,
    editor: (scheduleId: number) => ["schedules", "editor", scheduleId] as const,
};
