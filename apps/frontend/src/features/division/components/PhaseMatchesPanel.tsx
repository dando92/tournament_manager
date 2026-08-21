import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { faPenToSquare, faTrash } from "@fortawesome/free-solid-svg-icons";
import ActionsMenu from "@/shared/components/ui/ActionsMenu";
import PhaseGroupContent from "@/features/division/components/PhaseGroupContent";
import PhaseGroupSelector from "@/features/division/components/PhaseGroupSelector";
import PhaseGroupViewSelect from "@/features/division/components/PhaseGroupViewSelect";
import { usePhaseGroupActions } from "@/features/division/hooks/usePhaseGroupActions";
import { createPhaseGroup } from "@/features/division/services/phase-groups.api";
import { Division } from "@/features/division/types/Division";
import { Phase, PhaseGroup, PhaseGroupState } from "@/features/division/types/Phase";
import { formatBracketType } from "@/features/division/utils/bracketType";
import { MatchHighlight } from "@/features/match/types/Match";

type PhaseMatchesPanelProps = {
  phase: Phase;
  division: Division;
  controls: boolean;
  tournamentId?: number;
  highlight: MatchHighlight;
  onHighlight: (highlight: MatchHighlight) => void;
  onDeletePhase?: () => void | Promise<void>;
  onChanged?: () => Promise<void>;
};

export default function PhaseMatchesPanel(props: PhaseMatchesPanelProps) {
  const phaseGroups = props.phase.phaseGroups ?? [];
  const [selectedPhaseGroupId, setSelectedPhaseGroupId] = useState<number | null>(phaseGroups[0]?.id ?? null);
  const [creating, setCreating] = useState(false);
  const highlightedPhaseGroupId = props.highlight.phaseGroupId;
  const selectedPhaseGroup =
    phaseGroups.find((phaseGroup) => phaseGroup.id === selectedPhaseGroupId) ?? phaseGroups[0] ?? null;

  useEffect(() => {
    if (highlightedPhaseGroupId && phaseGroups.some((phaseGroup) => phaseGroup.id === highlightedPhaseGroupId)) {
      setSelectedPhaseGroupId(highlightedPhaseGroupId);
    }
  }, [highlightedPhaseGroupId, phaseGroups]);

  const handleCreatePhaseGroup = async () => {
    setCreating(true);
    try {
      await createPhaseGroup(props.phase.id, {});
      await props.onChanged?.();
      toast.success("Pool created.");
    } catch {
      toast.error("Error creating pool.");
    } finally {
      setCreating(false);
    }
  };

  const matchCount = props.phase.matchCount ?? props.phase.matches?.length ?? 0;
  const onCreate = props.controls && !creating ? handleCreatePhaseGroup : undefined;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <h4 className="text-sm font-semibold text-gray-700">{props.phase.name}</h4>
        <span className="text-xs text-gray-400">
          {matchCount} match{matchCount !== 1 ? "es" : ""}
        </span>
        {props.controls && props.onDeletePhase && (
          <div className="ml-auto">
            <ActionsMenu
              title="Phase actions"
              items={[
                {
                  key: "delete",
                  label: "Delete phase",
                  icon: faTrash,
                  danger: true,
                  onSelect: props.onDeletePhase,
                  confirm: {
                    message: `Delete phase "${props.phase.name}"? Its pools and their matches are deleted with it, and this cannot be undone.`,
                    confirmText: "Delete phase",
                  },
                },
              ]}
            />
          </div>
        )}
      </div>

      {selectedPhaseGroup ? (
        <SelectedPhaseGroupPanel
          key={selectedPhaseGroup.id}
          {...props}
          phaseGroups={phaseGroups}
          phaseGroup={selectedPhaseGroup}
          onSelect={setSelectedPhaseGroupId}
          onCreate={onCreate}
          highlightedPhaseGroupId={highlightedPhaseGroupId}
        />
      ) : (
        <>
          <PhaseGroupSelector
            phaseGroups={phaseGroups}
            selectedPhaseGroupId={null}
            onSelect={setSelectedPhaseGroupId}
            onCreate={onCreate}
          />
          <p className="py-8 text-center text-sm text-gray-400">
            {props.controls ? "No pool yet. Create one to add matches." : "No pool yet."}
          </p>
        </>
      )}
    </div>
  );
}

type SelectedPhaseGroupPanelProps = PhaseMatchesPanelProps & {
  phaseGroups: PhaseGroup[];
  phaseGroup: PhaseGroup;
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
  onSelect,
  onCreate,
  highlightedPhaseGroupId,
}: SelectedPhaseGroupPanelProps) {
  const actions = usePhaseGroupActions({ division, phaseGroup, onChanged });
  const bracketTypeLabel = formatBracketType(phaseGroup.bracketType);

  return (
    <>
      <PhaseGroupSelector
        phaseGroups={phaseGroups}
        selectedPhaseGroupId={phaseGroup.id}
        onSelect={onSelect}
        onCreate={onCreate}
        highlightedPhaseGroupId={highlightedPhaseGroupId}
        rightSlot={
          <>
            <PhaseGroupStateBadge state={phaseGroup.state} />
            {controls ? (
              <PhaseGroupViewSelect phaseGroup={phaseGroup} disabled={actions.saving} onChange={actions.changeView} />
            ) : (
              bracketTypeLabel && (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{bracketTypeLabel}</span>
              )
            )}
            {controls && (
              <ActionsMenu
                title="Pool actions"
                disabled={actions.saving || actions.deleting}
                busy={actions.deleting}
                items={[
                  {
                    key: "advancement",
                    label: "Edit advancement rules",
                    icon: faPenToSquare,
                    onSelect: actions.beginAdvancementEdit,
                  },
                  {
                    key: "delete",
                    label: "Delete pool",
                    icon: faTrash,
                    danger: true,
                    onSelect: actions.removePhaseGroup,
                    confirm: {
                      message: `Delete pool "${phaseGroup.name}"? Its matches are deleted with it, and this cannot be undone.`,
                      confirmText: "Delete pool",
                    },
                  },
                ]}
              />
            )}
          </>
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
