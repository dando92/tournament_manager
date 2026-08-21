import LobbyLiveBlock from "@/features/live/components/LobbyLiveBlock";
import { useLivePhase } from "@/features/live/hooks/useLivePhase";

type Props = {
  tournamentId: number;
  controls: boolean;
};

export default function TournamentLiveLobbies({ tournamentId, controls }: Props) {
  const { tournamentLiveStates } = useLivePhase(tournamentId);

  if (tournamentLiveStates.length === 0) {
    return <p className="text-ui-text-mute">No live lobbies.</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-4xl">
      {tournamentLiveStates.map((state) => (
        <LobbyLiveBlock
          key={state.lobbyId}
          lobbyState={state}
          showObsSource={controls}
        />
      ))}
    </div>
  );
}
