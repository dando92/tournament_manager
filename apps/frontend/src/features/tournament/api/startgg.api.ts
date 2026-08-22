import axios from "axios";
import {
  StartggImportPreviewRequest,
  StartggImportPreviewResponse,
  StartggImportResponse,
} from "@/features/tournament/model/types";

export async function previewStartggImport(
  tournamentId: number,
  payload: Omit<StartggImportPreviewRequest, "targetTournamentId">,
): Promise<StartggImportPreviewResponse> {
  const response = await axios.post<StartggImportPreviewResponse>(`tournaments/${tournamentId}/startgg/import-preview`, payload);
  return response.data;
}

export async function importStartggEvent(
  tournamentId: number,
  payload: Omit<StartggImportPreviewRequest, "targetTournamentId">,
): Promise<StartggImportResponse> {
  const response = await axios.post<StartggImportResponse>(`tournaments/${tournamentId}/startgg/import`, payload);
  return response.data;
}
