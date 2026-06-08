import LobbyLiveBlock from "@/features/live/components/LobbyLiveBlock";
import LivePendingLobbyCard from "@/features/live/components/LivePendingLobbyCard";
import { useLivePhase } from "@/features/live/hooks/useLivePhase";

type Props = {
  tournamentId: number;
};

export default function TournamentLiveLobbies({ tournamentId }: Props) {
  const { tournamentActiveLobbies, tournamentLiveStates, pendingLobbies } =
    useLivePhase(tournamentId);

  if (tournamentActiveLobbies.length === 0) {
    return <p className="text-gray-500">No active lobbies.</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-4xl">
      {tournamentLiveStates.map((state) => (
        <LobbyLiveBlock
          key={state.lobbyId}
          lobbyState={state}
        />
      ))}
      {pendingLobbies.map((lobby) => (
        <LivePendingLobbyCard key={lobby.lobbyId} lobbyName={lobby.lobbyName} />
      ))}
    </div>
  );
}
