import { AdvancementCompetitionKind, AdvancementRuleInput, Match } from "@/features/match/types/Match";
import { Division } from "@/features/division/types/Division";
import { btnSecondary } from "@/styles/buttonStyles";

type AdvancementRulesEditorProps = {
  sourceKind: AdvancementCompetitionKind;
  sourceId: number;
  rules: AdvancementRuleInput[];
  division: Division;
  allMatches: Match[];
  saving?: boolean;
  onChange: (rules: AdvancementRuleInput[]) => void;
  onSave: () => void;
  onCancel: () => void;
};

type TargetOption = {
  id: number;
  label: string;
};

const targetKindLabels: Record<AdvancementCompetitionKind, string> = {
  match: "Match",
  phase_group: "Pool",
};

export default function AdvancementRulesEditor({
  sourceKind,
  sourceId,
  rules,
  division,
  allMatches,
  saving = false,
  onChange,
  onSave,
  onCancel,
}: AdvancementRulesEditorProps) {
  const phaseGroups = (division.phases ?? []).flatMap((phase) =>
    (phase.phaseGroups ?? []).map((phaseGroup) => ({
      id: phaseGroup.id,
      label: `${phase.name} / ${phaseGroup.name}`,
    })),
  );
  const phaseGroupLabelById = new Map(phaseGroups.map((phaseGroup) => [phaseGroup.id, phaseGroup.label]));
  const matchOptions = [...allMatches]
    .filter((match) => !(sourceKind === "match" && match.id === sourceId))
    .sort((left, right) => left.id - right.id)
    .map((match) => ({
      id: match.id,
      label: `${phaseGroupLabelById.get(match.phaseGroupId) ?? "Unknown pool"} / ${match.name}`,
    }));
  const phaseGroupOptions = phaseGroups.filter((phaseGroup) => !(sourceKind === "phase_group" && phaseGroup.id === sourceId));

  const draftRules = rules.map((rule) => ({
    sourcePlacement: rule.sourcePlacement,
    targetKind: rule.targetKind,
    targetId: rule.targetId,
    targetSlot: rule.targetSlot,
  }));
  const errors = validateRules(draftRules, sourceKind, sourceId);
  const canSave = errors.length === 0 && !saving;

  const updateRule = (index: number, nextRule: AdvancementRuleInput) => {
    onChange(draftRules.map((rule, currentIndex) => (currentIndex === index ? nextRule : rule)));
  };

  const addRule = () => {
    const targetKind: AdvancementCompetitionKind = "match";
    const targetId = getOptions(targetKind, matchOptions, phaseGroupOptions)[0]?.id ?? 0;
    onChange([
      ...draftRules,
      {
        sourcePlacement: draftRules.length + 1,
        targetKind,
        targetId,
        targetSlot: draftRules.length + 1,
      },
    ]);
  };

  return (
    <div className="mt-4 rounded border border-gray-200 bg-gray-50 p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h5 className="text-sm font-semibold text-gray-700">Advancement rules</h5>
        <div className="flex items-center gap-2">
          <button type="button" className={`${btnSecondary} text-xs`} onClick={addRule} disabled={saving}>
            Add rule
          </button>
          <button type="button" className={`${btnSecondary} text-xs`} onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button type="button" className={`${btnSecondary} text-xs`} onClick={onSave} disabled={!canSave}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {draftRules.length === 0 ? (
        <p className="text-sm text-gray-500">No advancement rules configured.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {draftRules.map((rule, index) => {
            const targetOptions = getOptions(rule.targetKind, matchOptions, phaseGroupOptions);
            return (
              <div key={index} className="grid grid-cols-1 gap-2 sm:grid-cols-[90px_140px_1fr_90px_36px]">
                <input
                  type="number"
                  min={1}
                  value={rule.sourcePlacement}
                  onChange={(event) =>
                    updateRule(index, { ...rule, sourcePlacement: Number(event.target.value) })
                  }
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
                  aria-label="Source placement"
                />
                <select
                  value={rule.targetKind}
                  onChange={(event) => {
                    const targetKind = event.target.value as AdvancementCompetitionKind;
                    updateRule(index, {
                      ...rule,
                      targetKind,
                      targetId: getOptions(targetKind, matchOptions, phaseGroupOptions)[0]?.id ?? 0,
                    });
                  }}
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
                  aria-label="Target type"
                >
                  <option value="match">{targetKindLabels.match}</option>
                  <option value="phase_group">{targetKindLabels.phase_group}</option>
                </select>
                <select
                  value={rule.targetId}
                  onChange={(event) => updateRule(index, { ...rule, targetId: Number(event.target.value) })}
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
                  aria-label="Target"
                >
                  <option value={0}>Select target</option>
                  {targetOptions.map((target) => (
                    <option key={target.id} value={target.id}>
                      {target.label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={rule.targetSlot}
                  onChange={(event) => updateRule(index, { ...rule, targetSlot: Number(event.target.value) })}
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
                  aria-label="Target slot"
                />
                <button
                  type="button"
                  className="text-sm text-red-600"
                  onClick={() => onChange(draftRules.filter((_, currentIndex) => currentIndex !== index))}
                  aria-label="Delete advancement rule"
                >
                  x
                </button>
              </div>
            );
          })}
        </div>
      )}

      {errors.length > 0 && (
        <div className="mt-3 flex flex-col gap-1 text-xs text-red-600">
          {errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function getOptions(
  targetKind: AdvancementCompetitionKind,
  matchOptions: TargetOption[],
  phaseGroupOptions: TargetOption[],
): TargetOption[] {
  return targetKind === "match" ? matchOptions : phaseGroupOptions;
}

function validateRules(
  rules: AdvancementRuleInput[],
  sourceKind: AdvancementCompetitionKind,
  sourceId: number,
): string[] {
  const errors: string[] = [];
  const targetSlots = new Set<string>();

  for (const [index, rule] of rules.entries()) {
    const label = `Rule ${index + 1}`;
    if (rule.sourcePlacement <= 0 || !Number.isFinite(rule.sourcePlacement)) {
      errors.push(`${label}: source placement must be greater than 0.`);
    }
    if (rule.targetId <= 0 || !Number.isFinite(rule.targetId)) {
      errors.push(`${label}: select a target.`);
    }
    if (rule.targetSlot <= 0 || !Number.isFinite(rule.targetSlot)) {
      errors.push(`${label}: target slot must be greater than 0.`);
    }
    if (rule.targetKind === sourceKind && rule.targetId === sourceId) {
      errors.push(`${label}: source cannot target itself.`);
    }

    const targetKey = `${rule.targetKind}:${rule.targetId}:${rule.targetSlot}`;
    if (targetSlots.has(targetKey)) {
      errors.push(`${label}: target slot is already used.`);
    }
    targetSlots.add(targetKey);
  }

  return errors;
}
