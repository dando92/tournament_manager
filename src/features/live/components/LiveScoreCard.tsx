import { LiveMatchPlayerDto } from "@/features/live/services/syncstartGatewayDtos";

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
  const cardClass = player.isCompleted
    ? player.isFailed === true
      ? "bg-red-100 text-red-900"
      : "bg-green-100 text-green-900"
    : player.isFailed === true
      ? "bg-red-300 opacity-50 text-white"
      : "bg-gray-700 text-white";

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
            <span className={`font-bold text-xl ${player.isCompleted ? "text-inherit" : "text-cyan-400"}`}>{player.exScore.toFixed(2)}%</span>
          )}
          <span className={`font-bold ${player.exScore != null ? `text-sm ${player.isCompleted ? "opacity-80" : "text-white/70"}` : "text-xl"}`}>
            {player.score.toFixed(2)}%
          </span>
        </div>
      </div>
      {showJudgements && player.judgments && (
        <div className={`flex text-xs text-ellipsis flex-wrap gap-3 ${player.isCompleted ? "text-inherit" : "text-white"}`}>
          {player.judgments.fantasticPlus > 0 && (
            <span className={player.isCompleted ? "text-inherit" : "text-blue-200"}>{player.judgments.fantasticPlus}FA+</span>
          )}
          {player.judgments.fantastics > 0 && <span>{player.judgments.fantastics}FA</span>}
          {player.judgments.excellents > 0 && (
            <span className={player.isCompleted ? "text-inherit" : "text-yellow-300"}>{player.judgments.excellents}EX</span>
          )}
          {player.judgments.greats > 0 && (
            <span className={player.isCompleted ? "text-inherit" : "text-green-300"}>{player.judgments.greats}GR</span>
          )}
          {player.judgments.decents > 0 && (
            <span className={player.isCompleted ? "text-inherit" : "text-pink-300"}>{player.judgments.decents}DE</span>
          )}
          {player.judgments.wayOffs > 0 && (
            <span className={player.isCompleted ? "text-inherit" : "text-orange-300"}>{player.judgments.wayOffs}WO</span>
          )}
          {player.judgments.misses > 0 && (
            <span className={player.isCompleted ? "text-inherit" : "text-red-300"}>{player.judgments.misses}MISS</span>
          )}
        </div>
      )}
    </div>
  );
}
