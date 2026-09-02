import { useEffect, useState } from "react";
import AdvancementRulesModal from "@/features/match/ui/AdvancementRulesModal";
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
};

export default function PoolAdvancementEditor({
  division,
  phaseGroup,
  allMatches,
  onClose,
}: PoolAdvancementEditorProps) {
  const [rules, setRules] = useState<PhaseGroupAdvancementRuleInput[]>([]);

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

  /* The rules are on screen under the dialog, so a save that worked needs no
     sentence; one that did not keeps the dialog open and says so there. */
  const save = () => updateAdvancementRulesForSource("phase_group", phaseGroup.id, rules);

  return (
    <AdvancementRulesModal
      open
      sourceKind="phase_group"
      sourceId={phaseGroup.id}
      rules={rules}
      division={division}
      allMatches={allMatches}
      onChange={setRules}
      onSave={save}
      onCancel={onClose}
    />
  );
}
