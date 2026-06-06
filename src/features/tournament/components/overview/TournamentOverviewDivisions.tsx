import DivisionCard from "@/features/division/components/DivisionCard";
import { TournamentDivisionOption } from "@/features/tournament/types/TournamentDivisionOption";

type Props = {
  divisions: TournamentDivisionOption[];
  controls: boolean;
  onSelectDivision: (divisionId: number) => void;
  onDeleteDivision: (divisionId: number, divisionName: string) => Promise<void>;
};

export default function TournamentOverviewDivisions({
  divisions,
  controls,
  onSelectDivision,
  onDeleteDivision,
}: Props) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-center">
        <h2 className="text-lg font-bold text-gray-900">Divisions</h2>
        <p className="text-sm text-gray-500">Quick access to each division page.</p>
      </div>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {divisions.map((division) => (
          <DivisionCard
            key={division.id}
            division={division}
            controls={controls}
            onSelect={() => onSelectDivision(division.id)}
            onDelete={async () => {
              await onDeleteDivision(division.id, division.name);
            }}
          />
        ))}
        {divisions.length === 0 && (
          <p className="text-sm text-gray-400">No divisions yet.</p>
        )}
      </div>
    </div>
  );
}
