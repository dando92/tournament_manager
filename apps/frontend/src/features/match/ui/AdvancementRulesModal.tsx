import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faPlus, faTrash } from "@fortawesome/free-solid-svg-icons";
import { AdvancementCompetitionKind, AdvancementRuleInput, Match } from "@/features/match/model/types";
import { Division } from "@/features/division/model/types";
import BaseModal from "@/shared/components/ui/BaseModal";
import { btnCreate, btnPrimary, btnSecondary, btnTrash } from "@/styles/buttonStyles";

type AdvancementRulesModalProps = {
    open: boolean;
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
    kind: AdvancementCompetitionKind;
    id: number;
    label: string;
};

const inlineFieldClassName = "inline-flex min-h-7 items-center rounded bg-ui-raised px-1.5 py-0.5 font-medium text-ui-text transition-colors hover:bg-ui-selected focus-within:ring-2 focus-within:ring-state-running";
const numberInputClassName = "min-h-8 w-14 rounded border border-ui-border-strong bg-ui-raised px-2 py-1 text-sm font-medium text-ui-text outline-none focus:ring-2 focus:ring-ui-accent";

export default function AdvancementRulesModal({
    open,
    sourceKind,
    sourceId,
    rules,
    division,
    allMatches,
    saving = false,
    onChange,
    onSave,
    onCancel,
}: AdvancementRulesModalProps) {
    const phaseGroups = (division.phases ?? []).flatMap((phase) =>
        (phase.phaseGroups ?? []).map((phaseGroup) => ({
            kind: "phase_group" as const,
            id: phaseGroup.id,
            label: `${phase.name} / ${phaseGroup.displayIdentifier?.trim() || phaseGroup.name}`,
        })),
    );
    const phaseGroupLabelById = new Map(phaseGroups.map((phaseGroup) => [phaseGroup.id, phaseGroup.label]));
    const matchOptions: TargetOption[] = [...allMatches]
        .filter((match) => !(sourceKind === "match" && match.id === sourceId))
        .sort((left, right) => left.id - right.id)
        .map((match) => ({
            kind: "match",
            id: match.id,
            label: `${phaseGroupLabelById.get(match.phaseGroupId) ?? "Unknown pool"} / ${match.name}`,
        }));
    const phaseGroupOptions: TargetOption[] = phaseGroups.filter(
        (phaseGroup) => !(sourceKind === "phase_group" && phaseGroup.id === sourceId),
    );
    const targetOptions = [...matchOptions, ...phaseGroupOptions];
    const sourceLabel = sourceKind === "match"
        ? matchOptionsLabel(allMatches.find((match) => match.id === sourceId), phaseGroupLabelById)
        : phaseGroupLabelById.get(sourceId) ?? `Pool ${sourceId}`;

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
        const target = targetOptions[0];
        onChange([
            ...draftRules,
            {
                sourcePlacement: draftRules.length + 1,
                targetKind: target?.kind ?? "match",
                targetId: target?.id ?? 0,
                targetSlot: draftRules.length + 1,
            },
        ]);
    };

    const footer = (
        <div className="-mx-4 -mb-4 flex flex-col gap-2 border-t border-ui-border bg-ui-surface px-4 py-3 sm:-mx-6 sm:-mb-6 sm:flex-row sm:items-center sm:px-6">
            <button
                type="button"
                className={`${btnCreate} w-full rounded border px-3 py-2 text-sm sm:w-auto`}
                onClick={addRule}
                disabled={saving}
            >
                <FontAwesomeIcon icon={faPlus} className="mr-2 text-xs" />
                Add advancement
            </button>
            <div className="flex flex-col gap-2 sm:ml-auto sm:flex-row-reverse">
                <button type="button" className={`${btnPrimary} w-full text-sm sm:w-auto`} onClick={onSave} disabled={!canSave}>
                    {saving ? "Saving..." : "Save rules"}
                </button>
                <button type="button" className={`${btnSecondary} w-full text-sm sm:w-auto`} onClick={onCancel} disabled={saving}>
                    Cancel
                </button>
            </div>
        </div>
    );

    return (
        <BaseModal
            open={open}
            onClose={saving ? () => {} : onCancel}
            title={`Advancement from ${sourceLabel}`}
            footer={footer}
            maxWidth="max-w-4xl"
            fitViewport
        >
            <div className="flex flex-col">
                <p className="mb-3 text-sm text-ui-text-mute">Choose where each finishing position advances.</p>

                {draftRules.length === 0 ? (
                    <div className="rounded border border-dashed border-ui-border-strong bg-ui-canvas px-4 py-6 text-center text-sm text-ui-text-mute">
                        No advancement rules configured.
                    </div>
                ) : (
                    <div className="divide-y divide-ui-border border-y border-ui-border">
                        {draftRules.map((rule, index) => (
                            <div key={index} className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1.5 py-2.5 text-sm leading-8 text-ui-text-soft">
                                    <InlineNumber
                                        value={rule.sourcePlacement}
                                        disabled={saving}
                                        ariaLabel={`Rule ${index + 1} finishing place`}
                                        onChange={(sourcePlacement) => updateRule(index, { ...rule, sourcePlacement })}
                                    />
                                    <span>place</span>
                                    <span>advances to</span>
                                    <InlineDestination
                                        rule={rule}
                                        matchOptions={matchOptions}
                                        phaseGroupOptions={phaseGroupOptions}
                                        disabled={saving}
                                        ariaLabel={`Rule ${index + 1} destination`}
                                        onChange={(targetKind, targetId) => updateRule(index, { ...rule, targetKind, targetId })}
                                    />
                                    <span className="flex w-full items-center gap-1.5 sm:w-auto">
                                        <span>in slot</span>
                                        <InlineNumber
                                            value={rule.targetSlot}
                                            disabled={saving}
                                            ariaLabel={`Rule ${index + 1} target slot`}
                                            onChange={(targetSlot) => updateRule(index, { ...rule, targetSlot })}
                                        />
                                        <button
                                            type="button"
                                            className={`${btnTrash} ml-auto shrink-0 sm:ml-1`}
                                            onClick={() => onChange(draftRules.filter((_, currentIndex) => currentIndex !== index))}
                                            disabled={saving}
                                            aria-label={`Delete advancement rule ${index + 1}`}
                                        >
                                            <FontAwesomeIcon icon={faTrash} className="text-xs" />
                                        </button>
                                    </span>
                            </div>
                        ))}
                    </div>
                )}

                {errors.length > 0 && (
                    <div className="mt-3 flex flex-col gap-1 rounded border border-state-failed/40 px-3 py-2 text-xs text-state-failed" role="alert">
                        {errors.map((error) => <p key={error}>{error}</p>)}
                    </div>
                )}
            </div>
        </BaseModal>
    );
}

function InlineNumber({
    value,
    disabled,
    ariaLabel,
    onChange,
}: {
    value: number;
    disabled: boolean;
    ariaLabel: string;
    onChange: (value: number) => void;
}) {
    return (
        <input
            type="number"
            min={1}
            step={1}
            value={value}
            onChange={(event) => onChange(Number(event.target.value))}
            className={numberInputClassName}
            aria-label={ariaLabel}
            disabled={disabled}
        />
    );
}

function InlineDestination({
    rule,
    matchOptions,
    phaseGroupOptions,
    disabled,
    ariaLabel,
    onChange,
}: {
    rule: AdvancementRuleInput;
    matchOptions: TargetOption[];
    phaseGroupOptions: TargetOption[];
    disabled: boolean;
    ariaLabel: string;
    onChange: (kind: AdvancementCompetitionKind, id: number) => void;
}) {
    return (
        <span className={`${inlineFieldClassName} min-w-0 max-w-full`}>
            <select
                value={rule.targetId > 0 ? `${rule.targetKind}:${rule.targetId}` : ""}
                onChange={(event) => {
                    if (!event.target.value) {
                        onChange(rule.targetKind, 0);
                        return;
                    }
                    const [kind, rawId] = event.target.value.split(":");
                    onChange(kind as AdvancementCompetitionKind, Number(rawId));
                }}
                className="max-w-[calc(100vw-9rem)] min-w-0 appearance-none truncate bg-transparent p-0 font-medium text-ui-text outline-none sm:max-w-[32rem]"
                aria-label={ariaLabel}
                disabled={disabled}
            >
                <option value="">Select destination</option>
                {matchOptions.length > 0 && (
                    <optgroup label="Matches">
                        {matchOptions.map((target) => (
                            <option key={`match:${target.id}`} value={`match:${target.id}`}>{target.label}</option>
                        ))}
                    </optgroup>
                )}
                {phaseGroupOptions.length > 0 && (
                    <optgroup label="Pools">
                        {phaseGroupOptions.map((target) => (
                            <option key={`phase_group:${target.id}`} value={`phase_group:${target.id}`}>{target.label}</option>
                        ))}
                    </optgroup>
                )}
            </select>
            <FontAwesomeIcon icon={faChevronDown} className="ml-1.5 shrink-0 text-[10px] text-ui-text-mute" />
        </span>
    );
}

function matchOptionsLabel(match: Match | undefined, phaseGroupLabelById: Map<number, string>): string {
    if (!match) {
        return "Match";
    }
    return `${phaseGroupLabelById.get(match.phaseGroupId) ?? "Unknown pool"} / ${match.name}`;
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
            errors.push(`${label}: finishing place must be greater than 0.`);
        }
        if (rule.targetId <= 0 || !Number.isFinite(rule.targetId)) {
            errors.push(`${label}: select a destination.`);
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
