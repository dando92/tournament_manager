import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getEditor } from "@/features/control-room/api/control-room.api";
import { controlRoomKeys } from "@/features/control-room/api/control-room.keys";
import { localDateTimeToIso, toLocalDateTimeValue } from "@/features/control-room/model/flowDateTime";
import ControlRoomMatchAssignment, { type EditableFlowEntry } from "@/features/control-room/ui/ControlRoomMatchAssignment";
import BaseModal from "@/shared/components/ui/BaseModal";
import { btnDanger, btnPrimary, btnSecondary, focusRing } from "@/styles/buttonStyles";

type Props = {
    flowId: number | null;
    onClose: () => void;
    onSave: (
        flowId: number,
        version: number,
        entries: Array<{ matchId: number; expectedDurationMinutes: number }>,
        name: string,
        willStartAt: string,
        original: { name: string; willStartAt: string },
    ) => Promise<void>;
    onDelete: (flowId: number) => Promise<void>;
};

export default function ControlRoomEditor({ flowId, onClose, onSave, onDelete }: Props) {
    const query = useQuery({ queryKey: controlRoomKeys.editor(flowId ?? 0), queryFn: () => getEditor(flowId ?? 0), enabled: flowId !== null });
    const [name, setName] = useState("");
    const [willStartAt, setWillStartAt] = useState("");
    const [assigned, setAssigned] = useState<EditableFlowEntry[]>([]);
    const [unassigned, setUnassigned] = useState(query.data?.unassignedMatches ?? []);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!query.data) return;
        setName(query.data.flow.name);
        setWillStartAt(toLocalDateTimeValue(query.data.flow.willStartAt));
        setAssigned(query.data.flow.entries.map((entry) => ({ match: entry.match, expectedDurationMinutes: entry.expectedDurationMinutes })));
        setUnassigned(query.data.unassignedMatches);
    }, [query.data]);

    async function save() {
        if (!query.data || !name.trim() || !willStartAt) return;
        setSaving(true);
        try {
            await onSave(
                query.data.flow.id,
                query.data.flow.version,
                assigned.map((entry) => ({ matchId: entry.match.id, expectedDurationMinutes: entry.expectedDurationMinutes })),
                name.trim(),
                localDateTimeToIso(willStartAt),
                { name: query.data.flow.name, willStartAt: query.data.flow.willStartAt },
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
                    <button type="button" className={btnDanger} disabled={!query.data || saving} onClick={() => query.data && window.confirm(`Delete flow "${query.data.flow.name}"?`) && onDelete(query.data.flow.id).then(onClose)}>
                        Delete flow
                    </button>
                    <div className="flex gap-2">
                        <button type="button" className={btnSecondary} onClick={onClose}>Cancel</button>
                        <button type="button" className={btnPrimary} disabled={!query.data || !name.trim() || !willStartAt || saving} onClick={save}>
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
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <label className="text-sm font-semibold text-ui-text">
                            Flow name
                            <input value={name} onChange={(event) => setName(event.target.value)} className={`mt-1 block w-full rounded border border-ui-border bg-ui-canvas px-3 py-2 font-normal ${focusRing}`} />
                        </label>
                        <label className="text-sm font-semibold text-ui-text">
                            Will start at
                            <input type="datetime-local" value={willStartAt} onChange={(event) => setWillStartAt(event.target.value)} className={`mt-1 block w-full rounded border border-ui-border bg-ui-canvas px-3 py-2 font-normal ${focusRing}`} />
                        </label>
                    </div>
                    <ControlRoomMatchAssignment assigned={assigned} unassigned={unassigned} defaultExpectedDurationMinutes={30} onAssignedChange={setAssigned} onUnassignedChange={setUnassigned} />
                </div>
            )}
        </BaseModal>
    );
}
