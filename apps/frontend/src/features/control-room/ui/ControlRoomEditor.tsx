import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getEditor } from "@/features/control-room/api/control-room.api";
import { controlRoomKeys } from "@/features/control-room/api/control-room.keys";
import { localDateTimeToIso, toLocalDateTimeValue } from "@/features/control-room/model/flowDateTime";
import ControlRoomMatchAssignment, { type EditableFlowEntry } from "@/features/control-room/ui/ControlRoomMatchAssignment";
import FormModal from "@/shared/components/ui/FormModal";
import { btnDanger, focusRing } from "@/styles/buttonStyles";

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

    useEffect(() => {
        if (!query.data) return;
        setName(query.data.flow.name);
        setWillStartAt(toLocalDateTimeValue(query.data.flow.willStartAt));
        setAssigned(query.data.flow.entries.map((entry) => ({ match: entry.match, expectedDurationMinutes: entry.expectedDurationMinutes })));
        setUnassigned(query.data.unassignedMatches);
    }, [query.data]);

    const validate = () => {
        if (!query.data) {
            return ['This flow is not loaded yet.'];
        }

        const errors: string[] = [];
        if (!name.trim()) {
            errors.push('A flow needs a name.');
        }
        if (!willStartAt) {
            errors.push('A flow needs a start time.');
        }

        return errors;
    };

    const save = () =>
        onSave(
            query.data!.flow.id,
            query.data!.flow.version,
            assigned.map((entry) => ({ matchId: entry.match.id, expectedDurationMinutes: entry.expectedDurationMinutes })),
            name.trim(),
            localDateTimeToIso(willStartAt),
            { name: query.data!.flow.name, willStartAt: query.data!.flow.willStartAt },
        );

    const deleteFlow = (
        <button
            type="button"
            className={btnDanger}
            disabled={!query.data}
            onClick={() => query.data && window.confirm(`Delete flow "${query.data.flow.name}"?`) && onDelete(query.data.flow.id).then(onClose)}
        >
            Delete flow
        </button>
    );

    return (
        <FormModal
            open={flowId !== null}
            onClose={onClose}
            title="Edit control room flow"
            confirmText="Save flow"
            validate={validate}
            onConfirm={save}
            leadingActions={deleteFlow}
            failureFallback="The flow could not be saved."
            maxWidth="max-w-5xl"
            fitViewport
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
                            <input data-autofocus value={name} onChange={(event) => setName(event.target.value)} className={`mt-1 block w-full rounded border border-ui-border bg-ui-canvas px-3 py-2 font-normal ${focusRing}`} />
                        </label>
                        <label className="text-sm font-semibold text-ui-text">
                            Will start at
                            <input type="datetime-local" value={willStartAt} onChange={(event) => setWillStartAt(event.target.value)} className={`mt-1 block w-full rounded border border-ui-border bg-ui-canvas px-3 py-2 font-normal ${focusRing}`} />
                        </label>
                    </div>
                    <ControlRoomMatchAssignment assigned={assigned} unassigned={unassigned} defaultExpectedDurationMinutes={30} onAssignedChange={setAssigned} onUnassignedChange={setUnassigned} />
                </div>
            )}
        </FormModal>
    );
}
