type Props = {
  divisionCount: number;
  playerCount: number;
  matchCount: number;
};

export default function TournamentOverviewSummary({
  divisionCount,
  playerCount,
  matchCount,
}: Props) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Tournament information</h2>
          <p className="text-sm text-gray-500">Current workspace totals.</p>
        </div>
        <div className="grid grid-cols-3 gap-4 sm:gap-6">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-400">Divisions</div>
            <div className="mt-1 text-2xl font-black text-primary-dark">{divisionCount}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-400">Players</div>
            <div className="mt-1 text-2xl font-black text-primary-dark">{playerCount}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-400">Matches</div>
            <div className="mt-1 text-2xl font-black text-primary-dark">{matchCount}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
