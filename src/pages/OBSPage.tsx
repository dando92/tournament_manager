import { useParams } from "react-router-dom";
import LobbyLiveScores from "@/features/live/components/LobbyLiveScores";
import OBSWaitingState from "@/features/live/components/OBSWaitingState";
import { useOBSPage } from "@/features/live/hooks/useOBSPage";

export default function OBSPage() {
  const { lobbyId } = useParams<{ lobbyId: string }>();
  const { lobbyState } = useOBSPage(lobbyId);

  return (
    <div className="min-h-screen bg-transparent p-4">
      {lobbyState ? <LobbyLiveScores lobbyState={lobbyState} /> : <OBSWaitingState />}
    </div>
  );
}
