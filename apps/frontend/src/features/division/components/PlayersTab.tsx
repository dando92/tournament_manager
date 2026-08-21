import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Draggable, Droppable, DropResult } from "react-beautiful-dnd";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowDownAZ } from "@fortawesome/free-solid-svg-icons";
import { Division } from "@/features/division/types/Division";
import EntrantMembershipRow from "@/features/division/components/EntrantMembershipRow";
import PlayersByNameList from "@/features/division/components/PlayersByNameList";
import PlayersSearchBar from "@/features/division/components/PlayersSearchBar";
import PlayersWarning from "@/features/division/components/PlayersWarning";
import { usePlayersTab } from "@/features/division/hooks/usePlayersTab";
import { PhaseGroup } from "@/features/division/types/Phase";
import {
  addEntrantToPhaseGroup,
  listPhaseDivisionEntrants,
  listPhaseGroupEntrants,
  removeEntrantFromPhaseGroup,
  updatePhaseGroupSeeding,
} from "@/features/division/services/phase-groups.api";
import { toast } from "react-toastify";

type Props = {
  division: Division;
  canEdit: boolean;
  onPlayersChanged: () => void;
};

type EntrantScope = "division" | number;

type PhaseGroupScopeOption = {
  phaseId: number;
  phaseName: string;
  phaseGroup: PhaseGroup;
};

export default function PlayersTab({ division, canEdit, onPlayersChanged }: Props) {
  const [orderByName, setOrderByName] = useState(false);
  const state = usePlayersTab({ division, orderByName, onPlayersChanged });
  const phaseGroupOptions = useMemo(
    () =>
      (division.phases ?? []).flatMap((phase) =>
        (phase.phaseGroups ?? []).map((phaseGroup) => ({ phaseId: phase.id, phaseName: phase.name, phaseGroup })),
      ),
    [division.phases],
  );
  const [selectedScope, setSelectedScope] = useState<EntrantScope>("division");
  const selectedPhaseGroup =
    typeof selectedScope === "number"
      ? phaseGroupOptions.find((option) => option.phaseGroup.id === selectedScope) ?? null
      : null;

  return (
    <div className="flex flex-col gap-4 w-full">
      <EntrantScopeSelector
        phaseGroups={phaseGroupOptions}
        selectedScope={selectedScope}
        onSelect={setSelectedScope}
      />

      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <PlayersSearchBar value={state.search} onChange={state.setSearch} />
        </div>
        <button
          type="button"
          onClick={() => setOrderByName((current) => !current)}
          className={`flex shrink-0 items-center gap-2 rounded border px-3 py-2 text-xs font-medium transition-colors ${
            orderByName
              ? "border-primary-dark bg-primary-dark/10 text-primary-dark"
              : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
          }`}
          title={orderByName ? "Use default order" : "Order by name"}
        >
          <FontAwesomeIcon icon={faArrowDownAZ} />
          {orderByName ? "Name order" : "Default order"}
        </button>
      </div>
      <PlayersWarning warnings={[]} />

      {selectedPhaseGroup ? (
        <PhaseGroupEntrantsPanel
          phaseId={selectedPhaseGroup.phaseId}
          phaseGroup={selectedPhaseGroup.phaseGroup}
          search={state.search}
          orderByName={orderByName}
          canEdit={canEdit}
          onChanged={onPlayersChanged}
        />
      ) : (
        <PlayersByNameList
          players={state.filteredAllParticipants}
          canEdit={canEdit}
          divisionParticipantIds={state.divisionParticipantIds}
          onAdd={state.handleAdd}
          onRemove={state.handleRemove}
          totalParticipants={state.filteredAllParticipants.length}
        />
      )}
    </div>
  );
}

type EntrantScopeSelectorProps = {
  phaseGroups: PhaseGroupScopeOption[];
  selectedScope: EntrantScope;
  onSelect: (scope: EntrantScope) => void;
};

function EntrantScopeSelector({ phaseGroups, selectedScope, onSelect }: EntrantScopeSelectorProps) {
  return (
    <div className="overflow-x-auto">
      <div className="flex items-center gap-2 min-w-max pb-1">
        <EntrantScopeButton
          label="Division Entrants"
          selected={selectedScope === "division"}
          onClick={() => onSelect("division")}
        />
        {phaseGroups.map(({ phaseName, phaseGroup }) => (
          <EntrantScopeButton
            key={phaseGroup.id}
            label={`${phaseName}/${phaseGroup.name}`}
            selected={selectedScope === phaseGroup.id}
            onClick={() => onSelect(phaseGroup.id)}
          />
        ))}
      </div>
    </div>
  );
}

type EntrantScopeButtonProps = {
  label: string;
  selected: boolean;
  onClick: () => void;
};

function EntrantScopeButton({ label, selected, onClick }: EntrantScopeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start min-w-36 px-3 py-1.5 rounded border text-left transition-colors text-xs ${
        selected
          ? "border-primary-dark bg-primary-dark/10 text-primary-dark"
          : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      <span className={`font-medium ${selected ? "text-primary-dark" : "text-gray-700"}`}>{label}</span>
    </button>
  );
}

type PhaseGroupEntrantsPanelProps = {
  phaseId: number;
  phaseGroup: PhaseGroup;
  search: string;
  orderByName: boolean;
  canEdit: boolean;
  onChanged: () => void | Promise<void>;
};

function PhaseGroupEntrantsPanel({
  phaseId,
  phaseGroup,
  search,
  orderByName,
  canEdit,
  onChanged,
}: PhaseGroupEntrantsPanelProps) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [editingSeeding, setEditingSeeding] = useState(false);
  const divisionEntrantsQueryKey = useMemo(() => ["phase-division-entrants", phaseId] as const, [phaseId]);
  const phaseGroupEntrantsQueryKey = useMemo(
    () => ["phase-group-entrants", phaseGroup.id] as const,
    [phaseGroup.id],
  );
  const divisionEntrantsQuery = useQuery({
    queryKey: divisionEntrantsQueryKey,
    queryFn: () => listPhaseDivisionEntrants(phaseId),
  });
  const phaseGroupEntrantsQuery = useQuery({
    queryKey: phaseGroupEntrantsQueryKey,
    queryFn: () => listPhaseGroupEntrants(phaseGroup.id),
  });
  const divisionEntrants = divisionEntrantsQuery.data ?? [];
  const lowerSearch = search.toLowerCase();
  const divisionEntrantsInDbOrder = useMemo(
    () => [...(divisionEntrants ?? [])],
    [divisionEntrants],
  );
  const phaseGroupEntrants = useMemo(
    () =>
      [...(phaseGroupEntrantsQuery.data ?? [])].sort(
        (left, right) =>
          (left.seedNum ?? Number.MAX_SAFE_INTEGER) - (right.seedNum ?? Number.MAX_SAFE_INTEGER) ||
          left.entrant.name.localeCompare(right.entrant.name),
      ),
    [phaseGroupEntrantsQuery.data],
  );
  const [draftEntrantIds, setDraftEntrantIds] = useState<number[]>(() =>
    phaseGroupEntrants.map((entry) => entry.entrant.id),
  );
  const assignedEntrantIds = useMemo(
    () => new Set(phaseGroupEntrants.map((entry) => entry.entrant.id)),
    [phaseGroupEntrants],
  );
  const phaseGroupEntrantsByEntrantId = useMemo(
    () => new Map(phaseGroupEntrants.map((entry, index) => [entry.entrant.id, { entry, seedNumber: index + 1 }])),
    [phaseGroupEntrants],
  );
  const unassignedDivisionEntrants = useMemo(
    () => divisionEntrantsInDbOrder.filter((entrant) => !assignedEntrantIds.has(entrant.id)),
    [divisionEntrantsInDbOrder, assignedEntrantIds],
  );
  const displayedEntrantsByName = useMemo(
    () =>
      [
        ...phaseGroupEntrants.map((entry) => ({ kind: "assigned" as const, entry })),
        ...unassignedDivisionEntrants.map((entrant) => ({ kind: "unassigned" as const, entrant })),
      ]
        .filter((item) =>
          item.kind === "assigned"
            ? item.entry.entrant.name.toLowerCase().includes(lowerSearch)
            : item.entrant.name.toLowerCase().includes(lowerSearch),
        )
        .sort((left, right) => {
          const leftName = left.kind === "assigned" ? left.entry.entrant.name : left.entrant.name;
          const rightName = right.kind === "assigned" ? right.entry.entrant.name : right.entrant.name;
          return leftName.localeCompare(rightName);
        }),
    [lowerSearch, phaseGroupEntrants, unassignedDivisionEntrants],
  );
  const displayedUnassignedEntrants = useMemo(
    () => {
      const entrants = unassignedDivisionEntrants.filter((entrant) => entrant.name.toLowerCase().includes(lowerSearch));
      return orderByName ? entrants.sort((left, right) => left.name.localeCompare(right.name)) : entrants;
    },
    [lowerSearch, orderByName, unassignedDivisionEntrants],
  );
  const displayedAssignedEntrants = useMemo(
    () => orderByName ? [] : phaseGroupEntrants.filter((entry) => entry.entrant.name.toLowerCase().includes(lowerSearch)),
    [lowerSearch, orderByName, phaseGroupEntrants],
  );
  const displayedDraftAssignedEntrants = useMemo(
    () =>
      draftEntrantIds
        .map((entrantId, index) => {
          const metadata = phaseGroupEntrantsByEntrantId.get(entrantId);
          if (!metadata || !metadata.entry.entrant.name.toLowerCase().includes(lowerSearch)) return null;
          return {
            entry: metadata.entry,
            seedNumber: index + 1,
          };
        })
        .filter((entry): entry is { entry: (typeof phaseGroupEntrants)[number]; seedNumber: number } =>
          Boolean(entry),
        ),
    [draftEntrantIds, lowerSearch, phaseGroupEntrants, phaseGroupEntrantsByEntrantId],
  );

  useEffect(() => {
    setDraftEntrantIds(phaseGroupEntrants.map((entry) => entry.entrant.id));
  }, [phaseGroupEntrants]);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    setDraftEntrantIds((current) => {
      const visibleEntrantIds = current.filter((entrantId) => {
        const metadata = phaseGroupEntrantsByEntrantId.get(entrantId);
        return metadata ? metadata.entry.entrant.name.toLowerCase().includes(lowerSearch) : false;
      });
      const [moved] = visibleEntrantIds.splice(result.source.index, 1);
      visibleEntrantIds.splice(result.destination!.index, 0, moved);

      const visibleEntrantIdSet = new Set(visibleEntrantIds);
      let visibleIndex = 0;
      return current.map((entrantId) =>
        visibleEntrantIdSet.has(entrantId) ? visibleEntrantIds[visibleIndex++] : entrantId,
      );
    });
  };

  const handleSaveSeeding = async () => {
    setSaving(true);
    try {
      await updatePhaseGroupSeeding(phaseGroup.id, draftEntrantIds);
      setEditingSeeding(false);
      await refreshEntrants();
      await onChanged();
      toast.success("Pool seeding updated.");
    } catch {
      toast.error("Error updating pool seeding.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelSeeding = () => {
    setDraftEntrantIds(phaseGroupEntrants.map((entry) => entry.entrant.id));
    setEditingSeeding(false);
  };

  const refreshEntrants = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: divisionEntrantsQueryKey }),
      queryClient.invalidateQueries({ queryKey: phaseGroupEntrantsQueryKey }),
    ]);
  };

  const handleAddEntrant = async (entrantId: number) => {
    setSaving(true);
    try {
      await addEntrantToPhaseGroup(phaseGroup.id, entrantId);
      await refreshEntrants();
      await onChanged();
      toast.success("Entrant added to pool.");
    } catch {
      toast.error("Error adding entrant to pool.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveEntrant = async (entrantId: number) => {
    setSaving(true);
    try {
      await removeEntrantFromPhaseGroup(phaseGroup.id, entrantId);
      await refreshEntrants();
      await onChanged();
      toast.success("Entrant removed from pool.");
    } catch {
      toast.error("Error removing entrant from pool.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {canEdit && (
        <div className="flex items-center justify-end gap-2">
          {editingSeeding ? (
            <>
              <button
                type="button"
                onClick={handleCancelSeeding}
                disabled={saving}
                className="text-sm font-medium text-gray-500 hover:text-gray-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSeeding}
                disabled={saving}
                className="text-sm font-medium text-green-700 hover:text-green-900 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setEditingSeeding(true)}
              disabled={saving || phaseGroupEntrants.length === 0}
              className="text-sm font-medium text-green-700 hover:text-green-900 disabled:opacity-50"
            >
              Edit seeding
            </button>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1">
        {divisionEntrantsQuery.isLoading || phaseGroupEntrantsQuery.isLoading ? (
          <p className="text-sm text-gray-400 italic">Loading entrants...</p>
        ) : divisionEntrantsQuery.isError || phaseGroupEntrantsQuery.isError ? (
          <p className="text-sm text-red-500 italic">Could not load entrants.</p>
        ) : orderByName && displayedEntrantsByName.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No division entrants match your search.</p>
        ) : orderByName ? (
          <>
            {displayedEntrantsByName.map((item) => {
              if (item.kind === "unassigned") {
                return (
                  <EntrantMembershipRow
                    key={item.entrant.id}
                    name={item.entrant.name}
                    present={false}
                    canEdit={canEdit}
                    saving={saving}
                    onAdd={() => handleAddEntrant(item.entrant.id)}
                  />
                );
              }
              const metadata = phaseGroupEntrantsByEntrantId.get(item.entry.entrant.id);
              return (
                <EntrantMembershipRow
                  key={item.entry.entrant.id}
                  name={item.entry.entrant.name}
                  present
                  canEdit={canEdit}
                  saving={saving}
                  seedNumber={metadata?.seedNumber ?? null}
                  onRemove={() => handleRemoveEntrant(item.entry.entrant.id)}
                />
              );
            })}
          </>
        ) : !orderByName && displayedAssignedEntrants.length === 0 && displayedUnassignedEntrants.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No division entrants match your search.</p>
        ) : editingSeeding ? (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId={`phase-group-${phaseGroup.id}-seeding`}>
              {(provided) => (
                <div className="flex flex-col gap-1" ref={provided.innerRef} {...provided.droppableProps}>
                  {displayedDraftAssignedEntrants.map(({ entry, seedNumber }, index) => {
                    return (
                      <Draggable
                        key={entry.entrant.id}
                        draggableId={`phase-group-${phaseGroup.id}-entrant-${entry.entrant.id}`}
                        index={index}
                        isDragDisabled={saving}
                      >
                        {(drag) => (
                          <div
                            ref={drag.innerRef}
                            {...drag.draggableProps}
                          >
                            <EntrantMembershipRow
                              name={entry.entrant.name}
                              present
                              canEdit={canEdit}
                              saving={saving}
                              seedNumber={seedNumber}
                              editingSeeding
                              dragHandleProps={drag.dragHandleProps}
                            />
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                  {displayedUnassignedEntrants.map((entrant) => (
                    <EntrantMembershipRow
                      key={entrant.id}
                      name={entrant.name}
                      present={false}
                      canEdit={canEdit}
                      saving={saving}
                      editingSeeding
                    />
                  ))}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        ) : (
          <>
            {displayedAssignedEntrants.map((entry) => {
              const metadata = phaseGroupEntrantsByEntrantId.get(entry.entrant.id);
              return (
                <EntrantMembershipRow
                  key={entry.entrant.id}
                  name={entry.entrant.name}
                  present
                  canEdit={canEdit}
                  saving={saving}
                  seedNumber={metadata?.seedNumber ?? null}
                  onRemove={() => handleRemoveEntrant(entry.entrant.id)}
                />
              );
            })}
            {displayedUnassignedEntrants.map((entrant) => (
              <EntrantMembershipRow
                key={entrant.id}
                name={entrant.name}
                present={false}
                canEdit={canEdit}
                saving={saving}
                onAdd={() => handleAddEntrant(entrant.id)}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
