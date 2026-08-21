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
    <div className="rounded-xl border border-ui-border bg-ui-surface p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-ui-text">Tournament information</h2>
          <p className="text-sm text-ui-text-mute">Current workspace totals.</p>
        </div>
        <div className="grid grid-cols-3 gap-4 sm:gap-6">
          <div>
            <div className="text-xs uppercase tracking-wide text-ui-text-mute">Divisions</div>
            <div className="mt-1 text-2xl font-black text-ui-text">{divisionCount}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-ui-text-mute">Players</div>
            <div className="mt-1 text-2xl font-black text-ui-text">{playerCount}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-ui-text-mute">Matches</div>
            <div className="mt-1 text-2xl font-black text-ui-text">{matchCount}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
