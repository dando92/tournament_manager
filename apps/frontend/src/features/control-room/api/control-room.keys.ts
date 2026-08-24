export const controlRoomKeys = {
    all: (tournamentId: number) => ["control-room", tournamentId] as const,
    editor: (flowId: number) => ["control-room", "editor", flowId] as const,
};
