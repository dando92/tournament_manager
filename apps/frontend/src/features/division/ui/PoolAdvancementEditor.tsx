import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import AdvancementRulesEditor from "@/features/match/ui/AdvancementRulesEditor";
import { updateAdvancementRulesForSource } from "@/features/match/api/advancement-rule.api";
import { Division, PhaseGroup, PhaseGroupAdvancementRuleInput } from "@/features/division/model/types";
import { Match } from "@/features/match/model/types";

/**
 * Where a pool's finishers go next.
 *
 * It used to hang off the pool's own actions menu, which no longer exists —
 * the pool is a node in the tree now. Reaching it through `?edit=advancement`
 * keeps it addressable: the rules of a pool are a place you can be sent to,
 * not a mode you can only stumble into.
 */

type PoolAdvancementEditorProps = {
  division: Division;
  phaseGroup: PhaseGroup;
  allMatches: Match[];
  onClose: () => void;
  onSaved: () => Promise<void>;
};

export default function PoolAdvancementEditor({
  division,
  phaseGroup,
  allMatches,
  onClose,
  onSaved,
}: PoolAdvancementEditorProps) {
  const [rules, setRules] = useState<PhaseGroupAdvancementRuleInput[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRules(
      (phaseGroup.advancementRules ?? [])
        .filter((rule) => rule.sourceKind === "phase_group" && rule.sourceId === phaseGroup.id)
        .map((rule) => ({
          sourcePlacement: rule.sourcePlacement,
          targetKind: rule.targetKind,
          targetId: rule.targetId,
          targetSlot: rule.targetSlot,
        })),
    );
  }, [phaseGroup]);

  const save = async () => {
    setSaving(true);
    try {
      await updateAdvancementRulesForSource("phase_group", phaseGroup.id, rules);
      await onSaved();
      toast.success("Pool advancement rules updated.");
      onClose();
    } catch {
      toast.error("Error updating pool advancement rules.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdvancementRulesEditor
      sourceKind="phase_group"
      sourceId={phaseGroup.id}
      rules={rules}
      division={division}
      allMatches={allMatches}
      saving={saving}
      onChange={setRules}
      onSave={save}
      onCancel={onClose}
    />
  );
}
