import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getCreationData } from "@/features/control-room/api/control-room.api";
import { controlRoomKeys } from "@/features/control-room/api/control-room.keys";
import { defaultFlowStartValue, localDateTimeToIso } from "@/features/control-room/model/flowDateTime";
import ControlRoomMatchAssignment, { type EditableFlowEntry } from "@/features/control-room/ui/ControlRoomMatchAssignment";
import BaseModal from "@/shared/components/ui/BaseModal";
import { btnPrimary, btnSecondary, focusRing } from "@/styles/buttonStyles";

type Props = {
    tournamentId: number;
    open: boolean;
    onClose: () => void;
    onCreate: (input: { name: string; willStartAt: string; defaultExpectedDurationMinutes: number; matchIds: number[] }) => Promise<void>;
};

export default function CreateControlRoomFlowModal({ tournamentId, open, onClose, onCreate }: Props) {
    const query = useQuery({ queryKey: controlRoomKeys.creation(tournamentId), queryFn: () => getCreationData(tournamentId), enabled: open });
    const [name, setName] = useState("");
    const [willStartAt, setWillStartAt] = useState(defaultFlowStartValue);
    const [defaultDuration, setDefaultDuration] = useState(30);
    const [assigned, setAssigned] = useState<EditableFlowEntry[]>([]);
    const [unassigned, setUnassigned] = useState(query.data?.unassignedMatches ?? []);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open || !query.data) return;
        setAssigned([]);
        setUnassigned(query.data.unassignedMatches);
    }, [open, query.data]);

    async function create() {
        if (!name.trim() || !willStartAt || assigned.length === 0) return;
        setSaving(true);
        try {
            await onCreate({
                name: name.trim(),
                willStartAt: localDateTimeToIso(willStartAt),
                defaultExpectedDurationMinutes: defaultDuration,
                matchIds: assigned.map((entry) => entry.match.id),
            });
            setName("");
            setWillStartAt(defaultFlowStartValue());
            setDefaultDuration(30);
            onClose();
        } finally {
            setSaving(false);
        }
    }

    return (
        <BaseModal
            open={open}
            onClose={onClose}
            title="Create control room flow"
            maxWidth="max-w-5xl"
            fitViewport
            footer={
                <div className="flex justify-end gap-2">
                    <button type="button" className={btnSecondary} onClick={onClose}>Cancel</button>
                    <button type="button" className={btnPrimary} disabled={!name.trim() || !willStartAt || assigned.length === 0 || saving} onClick={create}>
                        {saving ? "Creating…" : "Create flow"}
                    </button>
                </div>
            }
        >
            {query.isLoading ? (
                <p className="text-sm text-ui-text-mute">Loading available matches…</p>
            ) : query.isError ? (
                <p className="text-sm text-state-failed">Unable to prepare flow creation.</p>
            ) : (
                <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <label className="text-sm font-semibold text-ui-text">
                            Flow name
                            <input value={name} onChange={(event) => setName(event.target.value)} className={`mt-1 block w-full rounded border border-ui-border bg-ui-canvas px-3 py-2 font-normal ${focusRing}`} />
                        </label>
                        <label className="text-sm font-semibold text-ui-text">
                            Will start at
                            <input type="datetime-local" value={willStartAt} onChange={(event) => setWillStartAt(event.target.value)} className={`mt-1 block w-full rounded border border-ui-border bg-ui-canvas px-3 py-2 font-normal ${focusRing}`} />
                        </label>
                        <label className="text-sm font-semibold text-ui-text">
                            Default match duration
                            <span className="mt-1 flex items-center gap-2">
                                <input type="number" min={1} max={1440} value={defaultDuration} onChange={(event) => setDefaultDuration(Math.max(1, Math.min(1440, Number(event.target.value))))} className={`block w-full rounded border border-ui-border bg-ui-canvas px-3 py-2 font-normal ${focusRing}`} />
                                <span className="font-normal text-ui-text-mute">min</span>
                            </span>
                        </label>
                    </div>
                    <p className="text-sm text-ui-text-mute">Drag matches into the flow and arrange their running order. The default duration is copied to every assigned match.</p>
                    <ControlRoomMatchAssignment assigned={assigned} unassigned={unassigned} defaultExpectedDurationMinutes={defaultDuration} editableDurations={false} onAssignedChange={setAssigned} onUnassignedChange={setUnassigned} />
                </div>
            )}
        </BaseModal>
    );
}
