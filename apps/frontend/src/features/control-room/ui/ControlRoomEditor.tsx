import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { DragDropContext, Draggable, Droppable, type DropResult } from "react-beautiful-dnd";
import { useQuery } from "@tanstack/react-query";
import type { MatchDto } from "@tournament-manager/contracts";

import { getEditor } from "@/features/control-room/api/control-room.api";
import { controlRoomKeys } from "@/features/control-room/api/control-room.keys";
import BaseModal from "@/shared/components/ui/BaseModal";
import { btnDanger, btnPrimary, btnSecondary, focusRing } from "@/styles/buttonStyles";

type Props = {
    flowId: number | null;
    onClose: () => void;
    onSave: (flowId: number, version: number, matchIds: number[], name: string, originalName: string) => Promise<void>;
    onDelete: (flowId: number) => Promise<void>;
};

export default function ControlRoomEditor({ flowId, onClose, onSave, onDelete }: Props) {
    const query = useQuery({
        queryKey: controlRoomKeys.editor(flowId ?? 0),
        queryFn: () => getEditor(flowId ?? 0),
        enabled: flowId !== null,
    });
    const [name, setName] = useState("");
    const [assigned, setAssigned] = useState<MatchDto[]>([]);
    const [unassigned, setUnassigned] = useState<MatchDto[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!query.data) return;
        setName(query.data.flow.name);
        setAssigned(query.data.flow.entries.map((entry) => entry.match));
        setUnassigned(query.data.unassignedMatches);
    }, [query.data]);

    function move(result: DropResult) {
        if (!result.destination) return;
        const sources = { assigned, unassigned };
        const setters = { assigned: setAssigned, unassigned: setUnassigned };
        const sourceKey = result.source.droppableId as keyof typeof sources;
        const destinationKey = result.destination.droppableId as keyof typeof sources;
        const source = [...sources[sourceKey]];
        const [match] = source.splice(result.source.index, 1);

        if (sourceKey === destinationKey) {
            source.splice(result.destination.index, 0, match);
            setters[sourceKey](source);
            return;
        }

        const destination = [...sources[destinationKey]];
        destination.splice(result.destination.index, 0, match);
        setters[sourceKey](source);
        setters[destinationKey](destination);
    }

    async function save() {
        if (!query.data || !name.trim()) return;
        setSaving(true);
        try {
            await onSave(
                query.data.flow.id,
                query.data.flow.version,
                assigned.map((match) => match.id),
                name.trim(),
                query.data.flow.name,
            );
            onClose();
        } finally {
            setSaving(false);
        }
    }

    return (
        <BaseModal
            open={flowId !== null}
            onClose={onClose}
            title="Edit control room flow"
            maxWidth="max-w-5xl"
            fitViewport
            footer={
                <div className="flex flex-wrap justify-between gap-2">
                    <button
                        type="button"
                        className={btnDanger}
                        disabled={!query.data || saving}
                        onClick={() => query.data && window.confirm(`Delete flow "${query.data.flow.name}"?`) && onDelete(query.data.flow.id).then(onClose)}
                    >
                        Delete flow
                    </button>
                    <div className="flex gap-2">
                        <button type="button" className={btnSecondary} onClick={onClose}>
                            Cancel
                        </button>
                        <button type="button" className={btnPrimary} disabled={!query.data || !name.trim() || saving} onClick={save}>
                            {saving ? "Saving…" : "Save flow"}
                        </button>
                    </div>
                </div>
            }
        >
            {query.isLoading ? (
                <p className="text-sm text-ui-text-mute">Loading flow…</p>
            ) : query.isError ? (
                <p className="text-sm text-state-failed">Unable to open this flow for editing.</p>
            ) : (
                <div className="flex flex-col gap-4">
                    <label className="text-sm font-semibold text-ui-text">
                        Flow name
                        <input
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            className={`mt-1 block w-full rounded border border-ui-border bg-ui-canvas px-3 py-2 font-normal ${focusRing}`}
                        />
                    </label>
                    <DragDropContext onDragEnd={move}>
                        <div className="grid min-h-0 grid-cols-1 gap-4 lg:grid-cols-2">
                            <MatchColumn
                                id="assigned"
                                title="Flow order"
                                matches={assigned}
                                onAddOrRemove={(match) => {
                                    setAssigned((current) => current.filter((candidate) => candidate.id !== match.id));
                                    setUnassigned((current) => [...current, match]);
                                }}
                            />
                            <MatchColumn
                                id="unassigned"
                                title="Unassigned"
                                matches={unassigned}
                                onAddOrRemove={(match) => {
                                    setUnassigned((current) => current.filter((candidate) => candidate.id !== match.id));
                                    setAssigned((current) => [...current, match]);
                                }}
                            />
                        </div>
                    </DragDropContext>
                </div>
            )}
        </BaseModal>
    );
}

function MatchColumn({
    id,
    title,
    matches,
    onAddOrRemove,
}: {
    id: "assigned" | "unassigned";
    title: string;
    matches: MatchDto[];
    onAddOrRemove: (match: MatchDto) => void;
}) {
    return (
        <Droppable droppableId={id}>
            {(provided) => (
                <section className="rounded-lg border border-ui-border bg-ui-raised p-3">
                    <h3 className="mb-2 font-semibold text-ui-text">
                        {title} <span className="text-xs font-normal text-ui-text-mute">({matches.length})</span>
                    </h3>
                    <div ref={provided.innerRef} {...provided.droppableProps} className="flex min-h-40 flex-col gap-2">
                        {matches.map((match, index) => (
                            <Draggable key={match.id} draggableId={`match-${match.id}`} index={index}>
                                {(drag, snapshot) => {
                                    const row = (
                                        <div
                                            ref={drag.innerRef}
                                            {...drag.draggableProps}
                                            {...drag.dragHandleProps}
                                            className={`flex cursor-grab items-center gap-2 rounded border border-ui-border bg-ui-surface px-3 py-2 active:cursor-grabbing ${snapshot.isDragging ? "shadow-lg" : ""}`}
                                            aria-label={`Drag ${match.name}`}
                                        >
                                            <span aria-hidden="true" className="text-ui-text-mute">⋮⋮</span>
                                            <span className="min-w-0 flex-1 truncate text-sm text-ui-text">{match.name}</span>
                                            <button type="button" onClick={() => onAddOrRemove(match)} className="text-xs text-ui-text-soft">
                                                {id === "assigned" ? "Remove" : "Add"}
                                            </button>
                                        </div>
                                    );

                                    return snapshot.isDragging ? createPortal(row, document.body) : row;
                                }}
                            </Draggable>
                        ))}
                        {provided.placeholder}
                        {matches.length === 0 && <p className="py-6 text-center text-sm text-ui-text-mute">Drop matches here.</p>}
                    </div>
                </section>
            )}
        </Droppable>
    );
}
