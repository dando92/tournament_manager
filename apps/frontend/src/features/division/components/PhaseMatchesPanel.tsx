import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import PhaseGroupActionsMenu from "@/features/division/components/PhaseGroupActionsMenu";
import PhaseGroupContent from "@/features/division/components/PhaseGroupContent";
import PhaseGroupSelector from "@/features/division/components/PhaseGroupSelector";
import { usePhaseGroupActions } from "@/features/division/hooks/usePhaseGroupActions";
import CreatePhaseGroupModal from "@/features/division/modals/CreatePhaseGroupModal";
import { createPhaseGroup } from "@/features/division/services/phase-groups.api";
import { Division } from "@/features/division/types/Division";
import { Phase, PhaseGroup, PhaseGroupState } from "@/features/division/types/Phase";
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

export default function PhaseMatchesPanel(props: PhaseMatchesPanelProps) {
  const phaseGroups = props.phase.phaseGroups ?? [];

  if (phaseGroups.length === 0) {
    return (
      <div>
        <PhaseHeader phase={props.phase} />
        <MatchList
          key={`phase-${props.phase.id}`}
          division={props.division}
          controls={props.controls}
          tournamentId={props.tournamentId}
          highlight={props.highlight}
          onHighlight={props.onHighlight}
        />
      </div>
    );
  }

  return <PhaseGroupsPanel {...props} phaseGroups={phaseGroups} />;
}

type PhaseGroupsPanelProps = PhaseMatchesPanelProps & {
  phaseGroups: PhaseGroup[];
};

function PhaseGroupsPanel({ phaseGroups, ...props }: PhaseGroupsPanelProps) {
  const [selectedPhaseGroupId, setSelectedPhaseGroupId] = useState(phaseGroups[0].id);
  const [createOpen, setCreateOpen] = useState(false);
  const highlightedPhaseGroupId = props.highlight.phaseGroupId;

  useEffect(() => {
    if (highlightedPhaseGroupId && phaseGroups.some((phaseGroup) => phaseGroup.id === highlightedPhaseGroupId)) {
      setSelectedPhaseGroupId(highlightedPhaseGroupId);
    }
  }, [highlightedPhaseGroupId, phaseGroups]);
  const selectedPhaseGroup =
    phaseGroups.find((phaseGroup) => phaseGroup.id === selectedPhaseGroupId) ?? phaseGroups[0];
  const showSelector = phaseGroups.length > 1;

  const handleCreatePhaseGroup = async (name: string, phaseId: number) => {
    try {
      await createPhaseGroup(phaseId, { name });
      await props.onChanged?.();
      toast.success("Phase group created.");
    } catch {
      toast.error("Error creating phase group.");
    }
  };

  return (
    <div>
      <PhaseHeader
        phase={props.phase}
        bracketTypeLabel={showSelector ? null : formatBracketType(selectedPhaseGroup.bracketType)}
      />
      <SelectedPhaseGroupPanel
        key={selectedPhaseGroup.id}
        {...props}
        phaseGroups={phaseGroups}
        phaseGroup={selectedPhaseGroup}
        showSelector={showSelector}
        onSelect={setSelectedPhaseGroupId}
        onCreate={props.controls ? () => setCreateOpen(true) : undefined}
        highlightedPhaseGroupId={highlightedPhaseGroupId}
      />
      <CreatePhaseGroupModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreatePhaseGroup}
        phases={[props.phase]}
        phaseId={props.phase.id}
      />
    </div>
  );
}

type SelectedPhaseGroupPanelProps = PhaseMatchesPanelProps & {
  phaseGroups: PhaseGroup[];
  phaseGroup: PhaseGroup;
  showSelector: boolean;
  onSelect: (phaseGroupId: number) => void;
  onCreate?: () => void;
  highlightedPhaseGroupId: number | null;
};

function SelectedPhaseGroupPanel({
  phase,
  phaseGroup,
  phaseGroups,
  division,
  controls,
  tournamentId,
  highlight,
  onHighlight,
  onChanged,
  showSelector,
  onSelect,
  onCreate,
  highlightedPhaseGroupId,
}: SelectedPhaseGroupPanelProps) {
  const actions = usePhaseGroupActions({ division, phaseGroup, onChanged });
  const bracketTypeLabel = formatBracketType(phaseGroup.bracketType);

  const actionsMenu = controls && (
    <PhaseGroupActionsMenu
      phaseGroupName={phaseGroup.name}
      disabled={actions.saving || actions.deleting}
      deleting={actions.deleting}
      onCreateMatch={actions.openCreateMatch}
      onEditAdvancementRules={actions.beginAdvancementEdit}
      onDeletePhaseGroup={actions.removePhaseGroup}
    />
  );

  return (
    <>
      {showSelector ? (
        <PhaseGroupSelector
          phaseGroups={phaseGroups}
          selectedPhaseGroupId={phaseGroup.id}
          onSelect={onSelect}
          onCreate={onCreate}
          highlightedPhaseGroupId={highlightedPhaseGroupId}
          rightSlot={
            <>
              <PhaseGroupStateBadge state={phaseGroup.state} />
              {bracketTypeLabel && (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{bracketTypeLabel}</span>
              )}
              {actionsMenu}
            </>
          }
        />
      ) : (
        actionsMenu && <div className="mb-3 flex justify-end">{actionsMenu}</div>
      )}
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
    </>
  );
}

function PhaseGroupStateBadge({ state }: { state: PhaseGroupState }) {
  const stateClass =
    state === "active"
      ? "bg-green-50 text-green-800"
      : state === "completed"
        ? "bg-blue-50 text-blue-800"
        : "bg-gray-100 text-gray-600";

  return <span className={`rounded-full px-2 py-0.5 text-xs ${stateClass}`}>{state}</span>;
}

type PhaseHeaderProps = {
  phase: Phase;
  bracketTypeLabel?: string | null;
};

function PhaseHeader({ phase, bracketTypeLabel }: PhaseHeaderProps) {
  const matchCount = phase.matchCount ?? phase.matches?.length ?? 0;

  return (
    <div className="flex items-center gap-2 mb-2">
      <h4 className="text-sm font-semibold text-gray-700">{phase.name}</h4>
      <span className="text-xs text-gray-400">
        {matchCount} match{matchCount !== 1 ? "es" : ""}
      </span>
      {bracketTypeLabel && (
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{bracketTypeLabel}</span>
      )}
    </div>
  );
}
