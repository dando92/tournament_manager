import { useState } from "react";
import { toast } from "react-toastify";
import { updateAdvancementRulesForSource } from "@/features/advancement/services/advancement-rules.api";
import { deletePhaseGroup } from "@/features/division/services/phase-groups.api";
import { Division } from "@/features/division/types/Division";
import { PhaseGroup, PhaseGroupAdvancementRuleInput } from "@/features/division/types/Phase";
import * as MatchesApi from "@/features/match/services/matches.api";
import { Match } from "@/features/match/types/Match";
import { CreateMatchRequest } from "@/features/match/types/match-requests";

type UsePhaseGroupActionsOptions = {
  division: Division;
  phaseGroup: PhaseGroup;
  onChanged?: () => Promise<void>;
};

export type PhaseGroupActions = ReturnType<typeof usePhaseGroupActions>;

export function usePhaseGroupActions({ division, phaseGroup, onChanged }: UsePhaseGroupActionsOptions) {
  const [editingAdvancement, setEditingAdvancement] = useState(false);
  const [draftRules, setDraftRules] = useState<PhaseGroupAdvancementRuleInput[]>([]);
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [createMatchOpen, setCreateMatchOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

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

  const cancelAdvancementEdit = () => setEditingAdvancement(false);

  const removePhaseGroup = async () => {
    setDeleting(true);
    try {
      await deletePhaseGroup(phaseGroup.id);
      await onChanged?.();
    } finally {
      setDeleting(false);
    }
  };

  const createMatch = async (request: CreateMatchRequest) => {
    await MatchesApi.create(request);
    await onChanged?.();
    toast.success("Match created.");
  };

  return {
    editingAdvancement,
    draftRules,
    setDraftRules,
    allMatches,
    createMatchOpen,
    deleting,
    saving,
    beginAdvancementEdit,
    saveAdvancementRules,
    cancelAdvancementEdit,
    removePhaseGroup,
    openCreateMatch: () => setCreateMatchOpen(true),
    closeCreateMatch: () => setCreateMatchOpen(false),
    createMatch,
  };
}
