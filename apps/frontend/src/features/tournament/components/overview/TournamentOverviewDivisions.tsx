import DivisionCard from "@/features/division/components/DivisionCard";
import { TournamentDivisionOption } from "@/features/tournament/types/TournamentDivisionOption";
import CreateCard from "@/shared/components/ui/CreateCard";

type Props = {
  divisions: TournamentDivisionOption[];
  controls: boolean;
  onSelectDivision: (divisionId: number) => void;
  onDeleteDivision: (divisionId: number, divisionName: string) => Promise<void>;
  onCreateDivision: () => void;
};

export default function TournamentOverviewDivisions({
  divisions,
  controls,
  onSelectDivision,
  onDeleteDivision,
  onCreateDivision,
}: Props) {
  return (
    <div className="rounded-xl border border-ui-border bg-ui-surface p-5 shadow-sm">
      <div className="text-center">
        <h2 className="text-lg font-bold text-ui-text">Divisions</h2>
        <p className="text-sm text-ui-text-mute">Quick access to each division page.</p>
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
        {controls ? (
          <CreateCard label="Create division" onClick={onCreateDivision} className="min-h-[160px]" />
        ) : (
          divisions.length === 0 && <p className="text-sm text-ui-text-mute">No divisions yet.</p>
        )}
      </div>
    </div>
  );
}
