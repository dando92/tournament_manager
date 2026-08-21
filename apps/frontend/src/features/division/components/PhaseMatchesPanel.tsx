import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { faPenToSquare, faTrash } from "@fortawesome/free-solid-svg-icons";
import ActionsMenu from "@/shared/components/ui/ActionsMenu";
import PhaseGroupContent from "@/features/division/components/PhaseGroupContent";
import PhaseGroupSelector from "@/features/division/components/PhaseGroupSelector";
import PhaseGroupViewSelect from "@/features/division/components/PhaseGroupViewSelect";
import { usePhaseGroupActions } from "@/features/division/hooks/usePhaseGroupActions";
import { usePoolViewMode } from "@/features/division/hooks/usePoolViewMode";
import { createPhaseGroup } from "@/features/division/services/phase-groups.api";
import { availablePoolViewModes } from "@/features/division/services/poolViewMode";
import { Division } from "@/features/division/types/Division";
import { Phase, PhaseGroup } from "@/features/division/types/Phase";
import { formatBracketType } from "@/features/division/utils/bracketType";
import { MatchHighlight } from "@/features/match/types/Match";

type PhaseMatchesPanelProps = {
  phase: Phase;
  division: Division;
  controls: boolean;
  tournamentId?: number;
  highlight: MatchHighlight;
  onHighlight: (highlight: MatchHighlight) => void;
  onChanged?: () => Promise<void>;
  /**
   * "stacked" is the summary, where the pool row names its phase because several are listed.
   * "focused" is a single open phase, already named by the breadcrumb above.
   */
  variant: "stacked" | "focused";
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

  const onCreate = props.controls && !creating ? handleCreatePhaseGroup : undefined;
  const phaseName = props.variant === "stacked" ? props.phase.name : undefined;

  return (
    <div>
      {selectedPhaseGroup ? (
        <SelectedPhaseGroupPanel
          key={selectedPhaseGroup.id}
          {...props}
          phaseGroups={phaseGroups}
          phaseGroup={selectedPhaseGroup}
          onSelect={setSelectedPhaseGroupId}
          onCreate={onCreate}
          highlightedPhaseGroupId={highlightedPhaseGroupId}
          phaseName={phaseName}
        />
      ) : (
        <>
          <PhaseGroupSelector
            phaseGroups={phaseGroups}
            selectedPhaseGroupId={null}
            onSelect={setSelectedPhaseGroupId}
            onCreate={onCreate}
            phaseName={phaseName}
          />
          <p className="py-8 text-center text-sm text-gray-500">
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
  phaseName?: string;
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
  phaseName,
  variant,
}: SelectedPhaseGroupPanelProps) {
  const actions = usePhaseGroupActions({ division, phaseGroup, onChanged });
  const [viewMode, setViewMode] = usePoolViewMode(phaseGroup);
  const bracketTypeLabel = formatBracketType(phaseGroup.bracketType);

  return (
    <>
      <PhaseGroupSelector
        phaseGroups={phaseGroups}
        selectedPhaseGroupId={phaseGroup.id}
        onSelect={onSelect}
        onCreate={onCreate}
        highlightedPhaseGroupId={highlightedPhaseGroupId}
        phaseName={phaseName}
        rightSlot={
          <>
            {bracketTypeLabel && (
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">{bracketTypeLabel}</span>
            )}
            <PhaseGroupViewSelect
              mode={viewMode}
              options={availablePoolViewModes(phaseGroup.bracketType)}
              onChange={setViewMode}
            />
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
        viewMode={viewMode}
        canCreateMatch={variant === "focused"}
      />
    </>
  );
}
