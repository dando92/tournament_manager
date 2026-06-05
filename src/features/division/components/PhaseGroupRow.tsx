import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faChevronRight, faDice } from "@fortawesome/free-solid-svg-icons";
import MatchList from "@/features/match/components/MatchList";
import { Division } from "@/features/division/types/Division";
import { Phase, PhaseGroup, PhaseGroupAdvancementRuleInput } from "@/features/division/types/Phase";
import { MatchState } from "@/features/match/types/Match";
import { Match } from "@/features/match/types/Match";
import DeleteConfirmButton from "@/shared/components/ui/DeleteConfirmButton";
import {
  deletePhaseGroup,
} from "@/features/division/services/phase-groups.api";
import { btnSecondary } from "@/styles/buttonStyles";
import { toast } from "react-toastify";
import CreateMatchModal from "@/features/match/modals/CreateMatchModal";
import { CreateMatchRequest } from "@/features/match/types/match-requests";
import * as MatchesApi from "@/features/match/services/matches.api";
import AdvancementRulesEditor from "@/features/advancement/components/AdvancementRulesEditor";
import { updateAdvancementRulesForSource } from "@/features/advancement/services/advancement-rules.api";

type PhaseGroupRowProps = {
  phase: Phase;
  phaseGroup: PhaseGroup;
  division: Division;
  controls: boolean;
  tournamentId?: number;
  matchRefreshKey?: number;
  matchStateFilter?: MatchState | "all";
  defaultExpanded?: boolean;
  onChanged?: () => Promise<void>;
};

export default function PhaseGroupRow({
  phase,
  phaseGroup,
  division,
  controls,
  tournamentId,
  matchRefreshKey,
  matchStateFilter = "all",
  defaultExpanded = false,
  onChanged,
}: PhaseGroupRowProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [editingAdvancement, setEditingAdvancement] = useState(false);
  const [draftRules, setDraftRules] = useState<PhaseGroupAdvancementRuleInput[]>([]);
  const [createMatchOpen, setCreateMatchOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const beginAdvancementEdit = async () => {
    const existing = (phaseGroup.advancementRules ?? [])
      .filter((rule) => rule.sourceKind === "phase_group" && rule.sourceId === phaseGroup.id)
      .map((rule) => ({
        sourcePlacement: rule.sourcePlacement,
        targetKind: rule.targetKind,
        targetId: rule.targetId,
        targetSlot: rule.targetSlot,
      }));
    setDraftRules(existing);
    setEditingAdvancement(true);
    try {
      setAllMatches(await MatchesApi.listByDivision(division.id));
    } catch {
      setAllMatches([]);
    }
  };

  const saveAdvancementRules = async () => {
    setSaving(true);
    try {
      await updateAdvancementRulesForSource("phase_group", phaseGroup.id, draftRules);
      setEditingAdvancement(false);
      await onChanged?.();
      toast.success("Phase group advancement rules updated.");
    } catch {
      toast.error("Error updating phase group advancement rules.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePhaseGroup = async () => {
    await deletePhaseGroup(phaseGroup.id);
    await onChanged?.();
  };

  const handleCreateMatch = async (request: CreateMatchRequest) => {
    await MatchesApi.create(request);
    await onChanged?.();
    toast.success("Match created.");
  };

  const content = (
    <MatchList
      key={`phase-group-${phaseGroup.id}`}
      division={division}
      phaseGroupId={phaseGroup.id}
      controls={controls}
      tournamentId={tournamentId}
      matchUpdateSignal={matchRefreshKey}
      matchStateFilter={matchStateFilter}
    />
  );

  return (
    <div className="border border-gray-200 rounded-md bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors"
      >
        <FontAwesomeIcon icon={expanded ? faChevronDown : faChevronRight} className="text-gray-500 w-3 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-800">{phaseGroup.name}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{phaseGroup.state}</span>
            <span className="text-xs text-gray-400">
              {phaseGroup.matchCount} match{phaseGroup.matchCount !== 1 ? "es" : ""}
            </span>
          </div>
        </div>
        {controls && (
          <div onClick={(event) => event.stopPropagation()} className="flex items-center gap-2">
            <button className={`${btnSecondary} text-xs`} onClick={beginAdvancementEdit} disabled={saving}>Edit advancement rules</button>
            <button className={`${btnSecondary} flex items-center gap-1.5 text-xs`} onClick={() => setCreateMatchOpen(true)} disabled={saving}>
              <FontAwesomeIcon icon={faDice} />
              <span>Match</span>
            </button>
            <DeleteConfirmButton
              title="Delete phase group"
              onConfirm={handleDeletePhaseGroup}
              className="text-sm"
              confirmMessage={`Delete phase group "${phaseGroup.name}"?`}
            />
          </div>
        )}
      </button>
      {editingAdvancement && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <AdvancementRulesEditor
            sourceKind="phase_group"
            sourceId={phaseGroup.id}
            rules={draftRules}
            division={division}
            allMatches={allMatches}
            saving={saving}
            onChange={setDraftRules}
            onSave={saveAdvancementRules}
            onCancel={() => setEditingAdvancement(false)}
          />
        </div>
      )}
      {expanded && !editingAdvancement && <div className="px-4 pb-4 border-t border-gray-100">{content}</div>}
      <CreateMatchModal
        open={createMatchOpen}
        onClose={() => setCreateMatchOpen(false)}
        onCreate={handleCreateMatch}
        divisionId={division.id}
        phaseId={phase.id}
        phaseGroupId={phaseGroup.id}
        phases={[{ ...phase, phaseGroups: [phaseGroup] }]}
        tournamentId={tournamentId}
      />
    </div>
  );
}
