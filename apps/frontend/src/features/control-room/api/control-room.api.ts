import axios from "axios";
import type { ControlRoomCreationDto, ControlRoomEditorDto, ControlRoomFlowDto, ControlRoomFlowEntryInputDto } from "@tournament-manager/contracts";

export async function listFlows(tournamentId: number): Promise<ControlRoomFlowDto[]> {
    const response = await axios.get<ControlRoomFlowDto[]>(`tournaments/${tournamentId}/control-room/flows`);
    return response.data;
}

export async function getEditor(flowId: number): Promise<ControlRoomEditorDto> {
    const response = await axios.get<ControlRoomEditorDto>(`control-room/flows/${flowId}/editor`);
    return response.data;
}

export async function getCreationData(tournamentId: number): Promise<ControlRoomCreationDto> {
    const response = await axios.get<ControlRoomCreationDto>(`tournaments/${tournamentId}/control-room/creation`);
    return response.data;
}

export async function createFlow(
    tournamentId: number,
    input: { name: string; willStartAt: string; defaultExpectedDurationMinutes: number; matchIds: number[] },
): Promise<number> {
    const response = await axios.post<{ id: number }>(`tournaments/${tournamentId}/control-room/flows`, input);
    return response.data.id;
}

export async function updateFlow(flowId: number, name: string, willStartAt: string): Promise<void> {
    await axios.patch(`control-room/flows/${flowId}`, { name, willStartAt });
}

export async function deleteFlow(flowId: number): Promise<void> {
    await axios.delete(`control-room/flows/${flowId}`);
}

export async function replaceEntries(flowId: number, version: number, entries: ControlRoomFlowEntryInputDto[]): Promise<void> {
    await axios.put(`control-room/flows/${flowId}/entries`, { version, entries });
}

export async function updateEntryTime(flowId: number, entryId: number, expectedDurationMinutes: number): Promise<void> {
    await axios.patch(`control-room/flows/${flowId}/entries/${entryId}/time`, { expectedDurationMinutes });
}

async function command(flowId: number, action: string): Promise<void> {
    await axios.post(`control-room/flows/${flowId}/${action}`);
}

export const startFlow = (flowId: number) => command(flowId, "start");
export const pauseFlow = (flowId: number) => command(flowId, "pause");
export const resumeFlow = (flowId: number) => command(flowId, "resume");
export const stopFlow = (flowId: number) => command(flowId, "stop");
export const archiveFlow = (flowId: number) => command(flowId, "archive");
export async function unarchiveFlow(flowId: number): Promise<void> {
    await axios.delete(`control-room/flows/${flowId}/archive`);
}
export async function startFromEntry(flowId: number, entryId: number): Promise<void> {
    await axios.post(`control-room/flows/${flowId}/start-from/${entryId}`);
}
