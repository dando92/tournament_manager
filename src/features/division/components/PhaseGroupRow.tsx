import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import MatchList from "@/features/match/components/MatchList";
import { Division } from "@/features/division/types/Division";
import { Phase, PhaseGroup, PhaseGroupAdvancementRuleInput } from "@/features/division/types/Phase";
import { MatchHighlight } from "@/features/match/types/Match";
import { Match } from "@/features/match/types/Match";
import {
  deletePhaseGroup,
} from "@/features/division/services/phase-groups.api";
import { toast } from "react-toastify";
import CreateMatchModal from "@/features/match/modals/CreateMatchModal";
import { CreateMatchRequest } from "@/features/match/types/match-requests";
import * as MatchesApi from "@/features/match/services/matches.api";
import AdvancementRulesEditor from "@/features/advancement/components/AdvancementRulesEditor";
import { updateAdvancementRulesForSource } from "@/features/advancement/services/advancement-rules.api";
import PhaseGroupActionsMenu from "@/features/division/components/PhaseGroupActionsMenu";

type PhaseGroupRowProps = {
  phase: Phase;
  phaseGroup: PhaseGroup;
  division: Division;
  controls: boolean;
  tournamentId?: number;
  highlight: MatchHighlight;
  onHighlight: (highlight: MatchHighlight) => void;
  defaultExpanded?: boolean;
  onChanged?: () => Promise<void>;
};

function formatBracketType(bracketType: string | null | undefined): string | null {
  switch (bracketType) {
    case "SingleElimination":
    case "SINGLE_ELIMINATION":
      return "Single elimination";
    case "DoubleElimination":
    case "DOUBLE_ELIMINATION":
      return "Double elimination";
    case "RoundRobin":
    case "ROUND_ROBIN":
      return "Round robin";
    case "Swiss":
    case "SWISS":
      return "Swiss";
    case "CustomSchedule":
    case "CUSTOM_SCHEDULE":
      return "Custom schedule";
    default:
      return bracketType ?? null;
  }
}

function phaseGroupStateClass(state: PhaseGroup["state"]): string {
  switch (state) {
    case "active":
      return "bg-green-50 text-green-800";
    case "completed":
      return "bg-blue-50 text-blue-800";
    case "pending":
    default:
      return "bg-gray-100 text-gray-600";
  }
}

export default function PhaseGroupRow({
  phase,
  phaseGroup,
  division,
  controls,
  tournamentId,
  highlight,
  onHighlight,
  defaultExpanded = false,
  onChanged,
}: PhaseGroupRowProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [editingAdvancement, setEditingAdvancement] = useState(false);
  const [draftRules, setDraftRules] = useState<PhaseGroupAdvancementRuleInput[]>([]);
  const [createMatchOpen, setCreateMatchOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const bracketTypeLabel = formatBracketType(phaseGroup.bracketType);
  const isHighlighted = highlight.phaseGroupId === phaseGroup.id;

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
    setDeleting(true);
    try {
      await deletePhaseGroup(phaseGroup.id);
      await onChanged?.();
    } finally {
      setDeleting(false);
    }
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
      phaseGroup={phaseGroup}
      controls={controls}
      tournamentId={tournamentId}
      highlight={highlight}
      onHighlight={onHighlight}
    />
  );

  return (
    <div className={`border rounded-md bg-white overflow-visible transition-shadow ${
      isHighlighted
        ? "border-green-400 ring-2 ring-green-300 shadow-green-100 shadow-lg"
        : "border-gray-200"
    }`}>
      <div className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="min-w-0 flex flex-1 items-center gap-3 text-left"
        >
          <FontAwesomeIcon icon={expanded ? faChevronDown : faChevronRight} className="text-gray-500 w-3 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-800">{phaseGroup.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${phaseGroupStateClass(phaseGroup.state)}`}>
                {phaseGroup.state}
              </span>
              {bracketTypeLabel && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{bracketTypeLabel}</span>
              )}
              <span className="text-xs text-gray-400">
                {phaseGroup.matchCount} match{phaseGroup.matchCount !== 1 ? "es" : ""}
              </span>
            </div>
          </div>
        </button>
        {controls && (
          <PhaseGroupActionsMenu
            phaseGroupName={phaseGroup.name}
            disabled={saving || deleting}
            deleting={deleting}
            onCreateMatch={() => setCreateMatchOpen(true)}
            onEditAdvancementRules={() => beginAdvancementEdit()}
            onDeletePhaseGroup={handleDeletePhaseGroup}
          />
        )}
      </div>
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
