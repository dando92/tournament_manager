import { LiveMatchStateDto } from "@/features/live/model/types";
import LiveScoreCard from "@/features/live/ui/LiveScoreCard";
import { useLiveScores } from "@/features/live/model/useLiveScores";

type Props = {
  lobbyState: LiveMatchStateDto;
  singleColumn?: boolean;
};

export default function LobbyLiveScores({ lobbyState, singleColumn }: Props) {
  const { showJudgements, sortedPlayers, songTitle } = useLiveScores(lobbyState);

  return (
    <div className="w-auto">
      <h2 className="text-ui-text">Now playing: {songTitle}</h2>
      <div className={`grid my-2 border-b pb-2 gap-1 ${singleColumn ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-3 lg:grid-cols-4"}`}>
        {sortedPlayers.map((player, idx) => (
          <LiveScoreCard
            key={player.playerName}
            player={player}
            rank={idx + 1}
            showJudgements={showJudgements}
          />
        ))}
      </div>
    </div>
  );
}
