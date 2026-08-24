import axios from "axios";
import type { ControlRoomEditorDto, ControlRoomFlowDto } from "@tournament-manager/contracts";

export async function listFlows(tournamentId: number): Promise<ControlRoomFlowDto[]> {
    const response = await axios.get<ControlRoomFlowDto[]>(`tournaments/${tournamentId}/control-room/flows`);
    return response.data;
}

export async function getEditor(flowId: number): Promise<ControlRoomEditorDto> {
    const response = await axios.get<ControlRoomEditorDto>(`control-room/flows/${flowId}/editor`);
    return response.data;
}

export async function createFlow(tournamentId: number, name: string): Promise<number> {
    const response = await axios.post<{ id: number }>(`tournaments/${tournamentId}/control-room/flows`, { name });
    return response.data.id;
}

export async function renameFlow(flowId: number, name: string): Promise<void> {
    await axios.patch(`control-room/flows/${flowId}`, { name });
}

export async function deleteFlow(flowId: number): Promise<void> {
    await axios.delete(`control-room/flows/${flowId}`);
}

export async function replaceEntries(flowId: number, version: number, matchIds: number[]): Promise<void> {
    await axios.put(`control-room/flows/${flowId}/entries`, { version, matchIds });
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
