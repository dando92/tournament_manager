import { useState } from "react";
import { toast } from "react-toastify";
import { updateAdvancementRulesForSource } from "@/features/advancement/services/advancement-rules.api";
import { deletePhaseGroup } from "@/features/division/services/phase-groups.api";
import { Division } from "@/features/division/types/Division";
import { PhaseGroup, PhaseGroupAdvancementRuleInput } from "@/features/division/types/Phase";
import { useCreateMatchAction } from "@/features/match/hooks/useCreateMatchAction";
import * as MatchesApi from "@/features/match/services/matches.api";
import { Match } from "@/features/match/types/Match";

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
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const matchCreation = useCreateMatchAction(onChanged);

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
      toast.success("Pool advancement rules updated.");
    } catch {
      toast.error("Error updating pool advancement rules.");
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

  return {
    editingAdvancement,
    draftRules,
    setDraftRules,
    allMatches,
    deleting,
    saving,
    beginAdvancementEdit,
    saveAdvancementRules,
    cancelAdvancementEdit,
    removePhaseGroup,
    ...matchCreation,
  };
}
