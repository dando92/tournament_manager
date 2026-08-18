import { TournamentDivisionOption } from "@/features/tournament/types/TournamentDivisionOption";
import { entrantPlayer } from "@/features/entrant/types/Entrant";
import { Player } from "@/features/player/types/Player";
import DeleteConfirmButton from "@/shared/components/ui/DeleteConfirmButton";

type DivisionCardProps = {
  division: TournamentDivisionOption;
  onSelect: () => void;
  controls?: boolean;
  onDelete?: () => void;
};

const MAX_VISIBLE_PLAYERS = 3;
const MAX_VISIBLE_PHASES = 4;

export default function DivisionCard({ division, onSelect, controls = false, onDelete }: DivisionCardProps) {
  const players = (division.entrants ?? []).map(entrantPlayer).filter((player): player is Player => Boolean(player));
  const visiblePlayers = players.slice(0, MAX_VISIBLE_PLAYERS);
  const extraPlayers = players.length - visiblePlayers.length;

  const visiblePhases = division.phases?.slice(0, MAX_VISIBLE_PHASES) ?? [];
  const extraPhases = (division.phases?.length ?? 0) - visiblePhases.length;

  const totalMatchCount = (division.phases ?? []).reduce((count, phase) => count + phase.matchCount, 0);

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow flex flex-col text-left overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-primary border-b border-white/10 flex items-center justify-between gap-2">
        <h3 className="font-bold text-white text-base leading-tight">{division.name}</h3>
        {controls && onDelete && (
          <DeleteConfirmButton
            title="Delete division"
            onConfirm={onDelete}
            className="text-sm"
            stopPropagation
            confirmMessage={`Delete division "${division.name}"?`}
          />
        )}
      </div>

      {/* Entrants */}
      <button type="button" onClick={onSelect} className="px-4 py-3 border-b border-gray-100 text-left">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-primary-dark shrink-0">Entrants</span>
          {visiblePlayers.length === 0 ? (
            <span className="text-xs text-gray-400 italic">No entrants</span>
          ) : (
            <>
              {visiblePlayers.map((p, i) => (
                <span key={p.id} className="text-xs text-gray-700">
                  {p.playerName}
                  {i < visiblePlayers.length - 1 && <span className="text-gray-300 ml-1">|</span>}
                </span>
              ))}
              {extraPlayers > 0 && (
                <span className="text-xs text-primary-dark/70">+{extraPlayers} more</span>
              )}
            </>
          )}
        </div>
      </button>

      {/* Brackets / Phases */}
      <button type="button" onClick={onSelect} className="px-4 py-3 flex-1 text-left">
        <div className="flex items-start gap-2">
          <span className="text-xs font-semibold text-primary-dark shrink-0 mt-0.5">Brackets</span>
          <div className="flex flex-col gap-1 min-w-0">
            {visiblePhases.length === 0 ? (
              <div className="flex items-center gap-1.5">
                <span className="text-gray-300 text-xs">◆</span>
                <span className="text-xs text-gray-600">
                  {totalMatchCount > 0 ? `${totalMatchCount} match${totalMatchCount !== 1 ? "es" : ""}` : "No bracket yet"}
                </span>
              </div>
            ) : (
              <>
                {visiblePhases.map((phase) => (
                  <div key={phase.id} className="flex items-center gap-1.5">
                    <span className="text-gray-400 text-xs">◆</span>
                    <div className="min-w-0">
                      <span className="text-xs font-medium text-gray-800">{phase.name}</span>
                      <span className="text-xs text-gray-400 ml-1">
                        {phase.matchCount} match{phase.matchCount !== 1 ? "es" : ""}
                      </span>
                    </div>
                  </div>
                ))}
                {extraPhases > 0 && (
                  <span className="text-xs text-gray-400 pl-4">+{extraPhases} more</span>
                )}
              </>
            )}
          </div>
        </div>
      </button>

      {/* CTA */}
      <button
        type="button"
        onClick={onSelect}
        className="px-4 py-3 border-t border-gray-100 flex items-center justify-center"
      >
        <span className="inline-flex items-center justify-center text-sm font-medium text-primary-dark">
          Open division
        </span>
      </button>
    </div>
  );
}
