import { useEffect, useMemo, useState } from "react";
import { DragDropContext, Draggable, Droppable, DropResult } from "react-beautiful-dnd";
import { toast } from "react-toastify";
import EntrantMembershipRow from "@/features/division/ui/EntrantMembershipRow";
import PlayersSearchBar from "@/features/division/ui/PlayersSearchBar";
import { updateDivisionSeeding } from "@/features/division/api/division.api";
import { Division } from "@/features/division/model/types";
import { Entrant } from "@/features/participant/model/types";
import { btnPrimary, btnSecondary } from "@/styles/buttonStyles";

type SeedingTabProps = {
  division: Division;
  canEdit: boolean;
  onSeedingChanged: () => void;
};

/**
 * The summary projection does not carry the persisted seed, so the tab opens on
 * the alphabetical order and the draft below it is what the person arranges.
 * FQ-015 records that the saved order is not read back.
 */
function byName(left: Entrant, right: Entrant): number {
  return left.name.localeCompare(right.name);
}

export default function SeedingTab({ division, canEdit, onSeedingChanged }: SeedingTabProps) {
  const entrants = useMemo(
    () => [...(division.entrants ?? [])].filter((entrant) => entrant.status === "active").sort(byName),
    [division.entrants],
  );
  const entrantsById = useMemo(() => new Map(entrants.map((entrant) => [entrant.id, entrant])), [entrants]);
  const [draftEntrantIds, setDraftEntrantIds] = useState<number[]>(() => entrants.map((entrant) => entrant.id));
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const lowerSearch = search.toLowerCase();

  useEffect(() => {
    setDraftEntrantIds(entrants.map((entrant) => entrant.id));
  }, [entrants]);

  const visibleEntrantIds = useMemo(
    () =>
      draftEntrantIds.filter((entrantId) =>
        (entrantsById.get(entrantId)?.name ?? "").toLowerCase().includes(lowerSearch),
      ),
    [draftEntrantIds, entrantsById, lowerSearch],
  );
  const dirty = useMemo(
    () => draftEntrantIds.some((entrantId, index) => entrants[index]?.id !== entrantId),
    [draftEntrantIds, entrants],
  );

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const reordered = [...visibleEntrantIds];
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);

    const reorderedSet = new Set(reordered);
    let visibleIndex = 0;
    setDraftEntrantIds((current) =>
      current.map((entrantId) => (reorderedSet.has(entrantId) ? reordered[visibleIndex++] : entrantId)),
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDivisionSeeding(division.id, draftEntrantIds);
      onSeedingChanged();
      toast.success("Division seeding updated.");
    } catch {
      toast.error("Error updating division seeding.");
    } finally {
      setSaving(false);
    }
  };

  if (entrants.length === 0) {
    return <p className="text-sm text-ui-text-mute italic">No entrants in this division yet.</p>;
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <PlayersSearchBar value={search} onChange={setSearch} />

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="division-seeding">
          {(droppableProvided) => (
            <div ref={droppableProvided.innerRef} {...droppableProvided.droppableProps} className="flex flex-col gap-1">
              {visibleEntrantIds.map((entrantId, index) => {
                const entrant = entrantsById.get(entrantId);
                if (!entrant) return null;

                return (
                  <Draggable
                    key={entrantId}
                    draggableId={`entrant-${entrantId}`}
                    index={index}
                    isDragDisabled={!canEdit || saving}
                  >
                    {(draggableProvided) => (
                      <div ref={draggableProvided.innerRef} {...draggableProvided.draggableProps}>
                        <EntrantMembershipRow
                          name={entrant.name}
                          present
                          canEdit={false}
                          saving={saving}
                          seedNumber={draftEntrantIds.indexOf(entrantId) + 1}
                          editingSeeding={canEdit}
                          dragHandleProps={draggableProvided.dragHandleProps}
                        />
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {droppableProvided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {canEdit && (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setDraftEntrantIds(entrants.map((entrant) => entrant.id))}
            disabled={!dirty || saving}
            className={`${btnSecondary} text-sm disabled:cursor-not-allowed disabled:opacity-60`}
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving}
            className={`${btnPrimary} text-sm disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {saving ? "Saving..." : "Save seeding"}
          </button>
        </div>
      )}
    </div>
  );
}
