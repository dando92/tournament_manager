export const controlRoomKeys = {
    all: (tournamentId: number) => ["control-room", tournamentId] as const,
    creation: (tournamentId: number) => ["control-room", "creation", tournamentId] as const,
    editor: (flowId: number) => ["control-room", "editor", flowId] as const,
};
