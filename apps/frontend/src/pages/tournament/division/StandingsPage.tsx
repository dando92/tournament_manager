import { useDivisionPageContext } from "@/features/division/model/DivisionPageContext";
import { useDivisionStandings } from "@/features/division/model/useDivisionStandings";

export default function DivisionStandingsPage() {
  const { divisionId } = useDivisionPageContext();
  const { rows, loaded } = useDivisionStandings(divisionId);

  if (!loaded) {
    return <p className="text-sm text-ui-text-mute italic">Loading standings...</p>;
  }

  if (rows.length === 0) {
    return <p className="text-sm text-ui-text-mute italic">No standings recorded yet.</p>;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-ui-border bg-ui-surface shadow-sm">
      <table className="min-w-full divide-y divide-ui-border text-sm">
        <thead className="bg-ui-raised">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-ui-text-soft">#</th>
            <th className="px-4 py-3 text-left font-semibold text-ui-text-soft">Player</th>
            <th className="px-4 py-3 text-left font-semibold text-ui-text-soft">Points</th>
            <th className="px-4 py-3 text-left font-semibold text-ui-text-soft">Songs</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ui-border">
          {rows.map((row, index) => (
            <tr key={row.id}>
              <td className="px-4 py-3 text-ui-text-mute">{index + 1}</td>
              <td className="px-4 py-3 font-medium text-ui-text">{row.playerName}</td>
              <td className="px-4 py-3 text-ui-text-soft">{row.points}</td>
              <td className="px-4 py-3 text-ui-text-soft">{row.songsPlayed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
