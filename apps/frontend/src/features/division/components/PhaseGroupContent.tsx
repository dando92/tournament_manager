import AdvancementRulesEditor from "@/features/advancement/components/AdvancementRulesEditor";
import { PhaseGroupActions } from "@/features/division/hooks/usePhaseGroupActions";
import { Division } from "@/features/division/types/Division";
import { PoolViewMode } from "@/features/division/services/poolViewMode";
import { Phase, PhaseGroup } from "@/features/division/types/Phase";
import MatchList from "@/features/match/components/MatchList";
import CreateMatchModal from "@/features/match/modals/CreateMatchModal";
import { MatchHighlight } from "@/features/match/types/Match";

type PhaseGroupContentProps = {
  phase: Phase;
  phaseGroup: PhaseGroup;
  division: Division;
  controls: boolean;
  tournamentId?: number;
  highlight: MatchHighlight;
  onHighlight: (highlight: MatchHighlight) => void;
  actions: PhaseGroupActions;
  viewMode: PoolViewMode;
  showMatches: boolean;
  bodyClassName?: string;
};

export default function PhaseGroupContent({
  phase,
  phaseGroup,
  division,
  controls,
  tournamentId,
  highlight,
  onHighlight,
  actions,
  viewMode,
  showMatches,
  bodyClassName,
}: PhaseGroupContentProps) {
  const body = actions.editingAdvancement ? (
    <AdvancementRulesEditor
      sourceKind="phase_group"
      sourceId={phaseGroup.id}
      rules={actions.draftRules}
      division={division}
      allMatches={actions.allMatches}
      saving={actions.saving}
      onChange={actions.setDraftRules}
      onSave={actions.saveAdvancementRules}
      onCancel={actions.cancelAdvancementEdit}
    />
  ) : showMatches ? (
    <MatchList
      key={`phase-group-${phaseGroup.id}`}
      division={division}
      phaseGroupId={phaseGroup.id}
      phaseGroup={phaseGroup}
      viewMode={viewMode}
      controls={controls}
      tournamentId={tournamentId}
      highlight={highlight}
      onHighlight={onHighlight}
      onCreateMatch={controls ? actions.openCreateMatch : undefined}
    />
  ) : null;

  return (
    <>
      {body && <div className={bodyClassName}>{body}</div>}
      <CreateMatchModal
        open={actions.createMatchOpen}
        onClose={actions.closeCreateMatch}
        onCreate={actions.createMatch}
        divisionId={division.id}
        phaseId={phase.id}
        phaseGroupId={phaseGroup.id}
        phases={[{ ...phase, phaseGroups: [phaseGroup] }]}
        tournamentId={tournamentId}
      />
    </>
  );
}
