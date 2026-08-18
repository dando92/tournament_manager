import { useDivisionPageContext } from "@/features/division/context/DivisionPageContext";
import { useDivisionStandings } from "@/features/division/hooks/useDivisionStandings";

export default function DivisionStandingsPage() {
  const { divisionId } = useDivisionPageContext();
  const { rows, loaded } = useDivisionStandings(divisionId);

  if (!loaded) {
    return <p className="text-sm text-gray-400 italic">Loading standings...</p>;
  }

  if (rows.length === 0) {
    return <p className="text-sm text-gray-400 italic">No standings recorded yet.</p>;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-gray-600">#</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600">Player</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600">Points</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600">Songs</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, index) => (
            <tr key={row.id}>
              <td className="px-4 py-3 text-gray-500">{index + 1}</td>
              <td className="px-4 py-3 font-medium text-gray-900">{row.playerName}</td>
              <td className="px-4 py-3 text-gray-700">{row.points}</td>
              <td className="px-4 py-3 text-gray-700">{row.songsPlayed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
