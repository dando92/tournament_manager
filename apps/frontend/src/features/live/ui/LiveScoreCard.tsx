import { LiveMatchPlayerDto } from "@/features/live/model/types";

type LiveScoreCardProps = {
  player: LiveMatchPlayerDto;
  rank: number;
  showJudgements: boolean;
};

export default function LiveScoreCard({
  player,
  rank,
  showJudgements,
}: LiveScoreCardProps) {
  // A running player keeps the near-black of the game screen, because that is
  // the background the judgment palette is designed to be read against. Failing
  // is marked by a red ring rather than by a pale surface: the ring sits behind
  // no text, so the judgment counts stay legible while the player is still on
  // the pad. Once the run is over the card turns into a light summary and drops
  // the judgment colouring with it.
  const cardClass = player.isCompleted
    ? player.isFailed === true
      ? "bg-state-failed/10 text-state-failed"
      : "bg-state-done/10 text-ui-text"
    : player.isFailed === true
      ? "bg-live-failed text-white ring-2 ring-state-failed"
      : "bg-live-screen text-white";

  return (
    <div
      className={`flex flex-col items-start p-2 rounded-md shadow-md transition-transform transform ${cardClass} ${
        rank === 1 ? "animate-first-place" : ""
      }`}
    >
      <div className="flex flex-row gap-5 justify-between items-end w-full">
        <span className="text-xl">
          <span className="italic">#{rank}</span> <span className="font-bold">{player.playerName}</span>
        </span>
        <div className="flex items-baseline gap-2">
          {player.exScore != null && (
            <span className={`font-bold text-xl ${player.isCompleted ? "text-inherit" : "text-ui-text-mute"}`}>{player.exScore.toFixed(2)}%</span>
          )}
          <span className={`font-bold ${player.exScore != null ? `text-sm ${player.isCompleted ? "opacity-80" : "text-white/70"}` : "text-xl"}`}>
            {player.score.toFixed(2)}%
          </span>
        </div>
      </div>
      {showJudgements && player.judgments && (
        <div className={`flex text-xs text-ellipsis flex-wrap gap-3 ${player.isCompleted ? "text-inherit" : "text-white"}`}>
          {player.judgments.fantasticPlus > 0 && (
            <span className={player.isCompleted ? "text-inherit" : "text-judgment-fantasticPlus"}>{player.judgments.fantasticPlus}FA+</span>
          )}
          {player.judgments.fantastics > 0 && <span>{player.judgments.fantastics}FA</span>}
          {player.judgments.excellents > 0 && (
            <span className={player.isCompleted ? "text-inherit" : "text-judgment-excellent"}>{player.judgments.excellents}EX</span>
          )}
          {player.judgments.greats > 0 && (
            <span className={player.isCompleted ? "text-inherit" : "text-judgment-great"}>{player.judgments.greats}GR</span>
          )}
          {player.judgments.decents > 0 && (
            <span className={player.isCompleted ? "text-inherit" : "text-judgment-decent"}>{player.judgments.decents}DE</span>
          )}
          {player.judgments.wayOffs > 0 && (
            <span className={player.isCompleted ? "text-inherit" : "text-judgment-wayOff"}>{player.judgments.wayOffs}WO</span>
          )}
          {player.judgments.misses > 0 && (
            <span className={player.isCompleted ? "text-inherit" : "text-judgment-miss"}>{player.judgments.misses}MISS</span>
          )}
        </div>
      )}
    </div>
  );
}
