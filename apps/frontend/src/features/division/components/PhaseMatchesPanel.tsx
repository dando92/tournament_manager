import PhaseGroupActionsMenu from "@/features/division/components/PhaseGroupActionsMenu";
import PhaseGroupContent from "@/features/division/components/PhaseGroupContent";
import PhaseGroupRow from "@/features/division/components/PhaseGroupRow";
import { usePhaseGroupActions } from "@/features/division/hooks/usePhaseGroupActions";
import { Division } from "@/features/division/types/Division";
import { Phase, PhaseGroup } from "@/features/division/types/Phase";
import { formatBracketType } from "@/features/division/utils/bracketType";
import MatchList from "@/features/match/components/MatchList";
import { MatchHighlight } from "@/features/match/types/Match";

type PhaseMatchesPanelProps = {
  phase: Phase;
  division: Division;
  controls: boolean;
  tournamentId?: number;
  highlight: MatchHighlight;
  onHighlight: (highlight: MatchHighlight) => void;
  onChanged?: () => Promise<void>;
};

export default function PhaseMatchesPanel({
  phase,
  division,
  controls,
  tournamentId,
  highlight,
  onHighlight,
  onChanged,
}: PhaseMatchesPanelProps) {
  const phaseGroups = phase.phaseGroups ?? [];

  if (phaseGroups.length === 1) {
    return (
      <SinglePhaseGroupPanel
        phase={phase}
        phaseGroup={phaseGroups[0]}
        division={division}
        controls={controls}
        tournamentId={tournamentId}
        highlight={highlight}
        onHighlight={onHighlight}
        onChanged={onChanged}
      />
    );
  }

  return (
    <div>
      <PhaseHeader phase={phase} />
      {phaseGroups.length > 0 ? (
        <div className="flex flex-col gap-3">
          {phaseGroups.map((phaseGroup) => (
            <PhaseGroupRow
              key={phaseGroup.id}
              phase={phase}
              phaseGroup={phaseGroup}
              division={division}
              controls={controls}
              tournamentId={tournamentId}
              highlight={highlight}
              onHighlight={onHighlight}
              onChanged={onChanged}
            />
          ))}
        </div>
      ) : (
        <MatchList
          key={`phase-${phase.id}`}
          division={division}
          controls={controls}
          tournamentId={tournamentId}
          highlight={highlight}
          onHighlight={onHighlight}
        />
      )}
    </div>
  );
}

type SinglePhaseGroupPanelProps = {
  phase: Phase;
  phaseGroup: PhaseGroup;
  division: Division;
  controls: boolean;
  tournamentId?: number;
  highlight: MatchHighlight;
  onHighlight: (highlight: MatchHighlight) => void;
  onChanged?: () => Promise<void>;
};

function SinglePhaseGroupPanel({
  phase,
  phaseGroup,
  division,
  controls,
  tournamentId,
  highlight,
  onHighlight,
  onChanged,
}: SinglePhaseGroupPanelProps) {
  const actions = usePhaseGroupActions({ division, phaseGroup, onChanged });

  return (
    <div>
      <PhaseHeader
        phase={phase}
        bracketTypeLabel={formatBracketType(phaseGroup.bracketType)}
        actionsMenu={
          controls && (
            <PhaseGroupActionsMenu
              phaseGroupName={phaseGroup.name}
              disabled={actions.saving || actions.deleting}
              deleting={actions.deleting}
              onCreateMatch={actions.openCreateMatch}
              onEditAdvancementRules={actions.beginAdvancementEdit}
              onDeletePhaseGroup={actions.removePhaseGroup}
            />
          )
        }
      />
      <PhaseGroupContent
        phase={phase}
        phaseGroup={phaseGroup}
        division={division}
        controls={controls}
        tournamentId={tournamentId}
        highlight={highlight}
        onHighlight={onHighlight}
        actions={actions}
        showMatches
      />
    </div>
  );
}

type PhaseHeaderProps = {
  phase: Phase;
  bracketTypeLabel?: string | null;
  actionsMenu?: React.ReactNode;
};

function PhaseHeader({ phase, bracketTypeLabel, actionsMenu }: PhaseHeaderProps) {
  const matchCount = phase.matchCount ?? phase.matches?.length ?? 0;

  return (
    <div className="flex items-center gap-2 mb-2">
      <h4 className="text-sm font-semibold text-gray-700">{phase.name}</h4>
      <span className="text-xs text-gray-400">
        {matchCount} match{matchCount !== 1 ? "es" : ""}
      </span>
      {bracketTypeLabel && (
        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{bracketTypeLabel}</span>
      )}
      {actionsMenu && <div className="ml-auto">{actionsMenu}</div>}
    </div>
  );
}
