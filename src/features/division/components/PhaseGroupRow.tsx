import { useMemo, useState } from "react";
import { DragDropContext, Draggable, Droppable, DropResult } from "react-beautiful-dnd";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight, faChevronDown, faChevronRight, faGripVertical } from "@fortawesome/free-solid-svg-icons";
import MatchList from "@/features/match/components/MatchList";
import { Division } from "@/features/division/types/Division";
import { Phase, PhaseGroup, PhaseGroupAdvancementRuleInput } from "@/features/division/types/Phase";
import { MatchState } from "@/features/match/types/Match";
import DeleteConfirmButton from "@/shared/components/ui/DeleteConfirmButton";
import {
  generatePhaseGroupBracket,
  updatePhaseGroupAdvancementRules,
  updatePhaseGroupSeeding,
} from "@/features/division/services/phase-groups.api";
import { btnSecondary } from "@/styles/buttonStyles";
import { toast } from "react-toastify";

type PhaseGroupRowProps = {
  phase: Phase;
  phaseGroup: PhaseGroup;
  division: Division;
  controls: boolean;
  tournamentId?: number;
  matchRefreshKey?: number;
  matchStateFilter?: MatchState | "all";
  defaultExpanded?: boolean;
  hiddenChrome?: boolean;
  onDeletePhase?: (phaseId: number) => Promise<void>;
  onChanged?: () => Promise<void>;
};

const entrantPreviewLimit = 8;

export default function PhaseGroupRow({
  phase,
  phaseGroup,
  division,
  controls,
  tournamentId,
  matchRefreshKey,
  matchStateFilter = "all",
  defaultExpanded = false,
  hiddenChrome = false,
  onDeletePhase,
  onChanged,
}: PhaseGroupRowProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [editingSeeding, setEditingSeeding] = useState(false);
  const [editingAdvancement, setEditingAdvancement] = useState(false);
  const [draftEntrantIds, setDraftEntrantIds] = useState<number[]>([]);
  const [draftRules, setDraftRules] = useState<PhaseGroupAdvancementRuleInput[]>([]);
  const [saving, setSaving] = useState(false);
  const entrants = useMemo(
    () =>
      [...(phaseGroup.entrants ?? [])].sort((left, right) => {
        const leftAdvanced = left.status === "advanced" ? 0 : 1;
        const rightAdvanced = right.status === "advanced" ? 0 : 1;
        return leftAdvanced - rightAdvanced || (left.seedNum ?? Number.MAX_SAFE_INTEGER) - (right.seedNum ?? Number.MAX_SAFE_INTEGER);
      }),
    [phaseGroup.entrants],
  );
  const previewEntrants = entrants.slice(0, entrantPreviewLimit);
  const hiddenCount = Math.max(0, entrants.length - previewEntrants.length);
  const targetPhaseGroups = useMemo(
    () =>
      (division.phases ?? [])
        .flatMap((candidatePhase) => candidatePhase.phaseGroups ?? [])
        .filter((candidateGroup) => candidateGroup.id !== phaseGroup.id),
    [division.phases, phaseGroup.id],
  );

  const beginSeedingEdit = () => {
    setDraftEntrantIds(entrants.map((entry) => entry.entrant.id));
    setEditingSeeding(true);
  };

  const handleSeedDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    setDraftEntrantIds((current) => {
      const next = [...current];
      const [moved] = next.splice(result.source.index, 1);
      next.splice(result.destination!.index, 0, moved);
      return next;
    });
  };

  const saveSeeding = async () => {
    setSaving(true);
    try {
      await updatePhaseGroupSeeding(phaseGroup.id, draftEntrantIds);
      setEditingSeeding(false);
      await onChanged?.();
      toast.success("Phase group seeding updated.");
    } catch {
      toast.error("Error updating phase group seeding.");
    } finally {
      setSaving(false);
    }
  };

  const beginAdvancementEdit = () => {
    const existing = (phaseGroup.advancementRules ?? [])
      .filter((rule) => rule.sourceKind === "phase_group" && rule.sourceId === phaseGroup.id && rule.targetKind === "phase_group")
      .map((rule) => ({
        sourcePlacement: rule.sourcePlacement,
        targetId: rule.targetId,
        targetSlot: rule.targetSlot,
      }));
    setDraftRules(existing.length > 0 ? existing : [{ sourcePlacement: 1, targetId: targetPhaseGroups[0]?.id ?? 0, targetSlot: 1 }]);
    setEditingAdvancement(true);
  };

  const saveAdvancementRules = async () => {
    setSaving(true);
    try {
      await updatePhaseGroupAdvancementRules(
        phaseGroup.id,
        draftRules.filter((rule) => rule.targetId > 0 && rule.sourcePlacement > 0 && rule.targetSlot > 0),
      );
      setEditingAdvancement(false);
      await onChanged?.();
      toast.success("Phase group advancement rules updated.");
    } catch {
      toast.error("Error updating phase group advancement rules.");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateBracket = async () => {
    setSaving(true);
    try {
      await generatePhaseGroupBracket(phaseGroup.id, phaseGroup.bracketType ?? "SingleElimination", division.playersPerMatch ?? 2);
      await onChanged?.();
      toast.success("Phase group bracket generated.");
    } catch {
      toast.error("Error generating phase group bracket.");
    } finally {
      setSaving(false);
    }
  };

  const content = (
    <>
      {editingSeeding && (
        <div className="mt-4 rounded border border-gray-200 bg-gray-50 p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h5 className="text-sm font-semibold text-gray-700">Phase group seeding</h5>
            <div className="flex items-center gap-2">
              <button className={`${btnSecondary} text-xs`} onClick={() => setEditingSeeding(false)} disabled={saving}>Cancel</button>
              <button className={`${btnSecondary} text-xs`} onClick={saveSeeding} disabled={saving}>{saving ? "Saving..." : "Save"}</button>
            </div>
          </div>
          <DragDropContext onDragEnd={handleSeedDragEnd}>
            <Droppable droppableId={`phase-group-${phaseGroup.id}-seeding`}>
              {(provided) => (
                <div className="flex flex-col gap-1" ref={provided.innerRef} {...provided.droppableProps}>
                  {draftEntrantIds.map((entrantId, index) => {
                    const entry = entrants.find((candidate) => candidate.entrant.id === entrantId);
                    if (!entry) return null;
                    return (
                      <Draggable key={entrantId} draggableId={String(entrantId)} index={index}>
                        {(drag) => (
                          <div
                            ref={drag.innerRef}
                            {...drag.draggableProps}
                            className="flex items-center gap-3 rounded border border-gray-200 bg-white px-3 py-2 text-sm"
                          >
                            <span className="w-8 text-xs font-bold text-primary-dark">#{index + 1}</span>
                            <span className="flex-1">{entry.entrant.name}</span>
                            <span {...drag.dragHandleProps} className="cursor-grab text-gray-400">
                              <FontAwesomeIcon icon={faGripVertical} />
                            </span>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>
      )}
      {editingAdvancement && (
        <div className="mt-4 rounded border border-gray-200 bg-gray-50 p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h5 className="text-sm font-semibold text-gray-700">Phase group advancement rules</h5>
            <div className="flex items-center gap-2">
              <button className={`${btnSecondary} text-xs`} onClick={() => setDraftRules((current) => [...current, { sourcePlacement: current.length + 1, targetId: targetPhaseGroups[0]?.id ?? 0, targetSlot: current.length + 1 }])}>
                Add rule
              </button>
              <button className={`${btnSecondary} text-xs`} onClick={() => setEditingAdvancement(false)} disabled={saving}>Cancel</button>
              <button className={`${btnSecondary} text-xs`} onClick={saveAdvancementRules} disabled={saving}>{saving ? "Saving..." : "Save"}</button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {draftRules.map((rule, index) => (
              <div key={index} className="grid grid-cols-1 gap-2 sm:grid-cols-[90px_1fr_90px_36px]">
                <input
                  type="number"
                  min={1}
                  value={rule.sourcePlacement}
                  onChange={(event) => setDraftRules((current) => current.map((candidate, i) => i === index ? { ...candidate, sourcePlacement: Number(event.target.value) } : candidate))}
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
                  aria-label="Source placement"
                />
                <select
                  value={rule.targetId}
                  onChange={(event) => setDraftRules((current) => current.map((candidate, i) => i === index ? { ...candidate, targetId: Number(event.target.value) } : candidate))}
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
                  aria-label="Target phase group"
                >
                  <option value={0}>Select target group</option>
                  {targetPhaseGroups.map((targetGroup) => (
                    <option key={targetGroup.id} value={targetGroup.id}>{targetGroup.name}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={rule.targetSlot}
                  onChange={(event) => setDraftRules((current) => current.map((candidate, i) => i === index ? { ...candidate, targetSlot: Number(event.target.value) } : candidate))}
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
                  aria-label="Target slot"
                />
                <button className="text-sm text-red-500" onClick={() => setDraftRules((current) => current.filter((_, i) => i !== index))}>x</button>
              </div>
            ))}
          </div>
        </div>
      )}
      <MatchList
      key={`phase-group-${phaseGroup.id}`}
      division={division}
      phaseGroupId={phaseGroup.id}
        controls={controls}
        tournamentId={tournamentId}
        matchUpdateSignal={matchRefreshKey}
        matchStateFilter={matchStateFilter}
      />
    </>
  );

  if (hiddenChrome) {
    return content;
  }

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
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            {previewEntrants.length === 0 ? (
              <span className="text-xs text-gray-400">No entrants assigned</span>
            ) : (
              previewEntrants.map((phaseGroupEntrant) => (
                <span
                  key={phaseGroupEntrant.id}
                  className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                >
                  {phaseGroupEntrant.status === "advanced" && (
                    <FontAwesomeIcon icon={faArrowRight} className="text-emerald-600" />
                  )}
                  {phaseGroupEntrant.entrant.name}
                </span>
              ))
            )}
            {hiddenCount > 0 && <span className="text-xs text-gray-400">+{hiddenCount} more</span>}
          </div>
        </div>
        {controls && (
          <div onClick={(event) => event.stopPropagation()} className="flex items-center gap-2">
            <button className={`${btnSecondary} text-xs`} onClick={beginSeedingEdit} disabled={saving}>Seeding</button>
            <button className={`${btnSecondary} text-xs`} onClick={beginAdvancementEdit} disabled={saving}>Advancement</button>
            <button className={`${btnSecondary} text-xs`} onClick={handleGenerateBracket} disabled={saving}>Generate</button>
            {onDeletePhase && (
            <DeleteConfirmButton
              title="Delete phase"
              onConfirm={() => onDeletePhase(phase.id)}
              className="text-sm"
              confirmMessage={`Delete phase "${phase.name}"?`}
            />
            )}
          </div>
        )}
      </button>
      {expanded && <div className="px-4 pb-4 border-t border-gray-100">{content}</div>}
    </div>
  );
}
