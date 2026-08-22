import { useParams, useSearchParams } from "react-router-dom";
import LobbyLiveScores from "@/features/live/ui/LobbyLiveScores";
import OBSWaitingState from "@/features/live/ui/OBSWaitingState";
import { useOBSPage } from "@/features/live/model/useOBSPage";

export default function OBSPage() {
  const { lobbyId } = useParams<{ lobbyId: string }>();
  const [searchParams] = useSearchParams();
  const tournamentIdValue = Number(searchParams.get("tournamentId"));
  const tournamentId = Number.isFinite(tournamentIdValue) ? tournamentIdValue : undefined;
  const { lobbyState } = useOBSPage(lobbyId, tournamentId);

  return (
    <div className="min-h-screen bg-transparent p-4">
      {lobbyState ? <LobbyLiveScores lobbyState={lobbyState} /> : <OBSWaitingState />}
    </div>
  );
}
