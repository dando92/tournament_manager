import { useState } from "react";

import { useTournamentPageContext } from "@/features/tournament/model/TournamentPageContext";
import { useControlRoom } from "@/features/control-room/model/useControlRoom";
import ControlRoomFlowPanel from "@/features/control-room/ui/ControlRoomFlowPanel";
import ControlRoomFlowCarousel from "@/features/control-room/ui/ControlRoomFlowCarousel";
import ControlRoomEditor from "@/features/control-room/ui/ControlRoomEditor";
import CreateControlRoomFlowModal from "@/features/control-room/ui/CreateControlRoomFlowModal";
import LobbyControlCard from "@/features/control-room/ui/LobbyControlCard";
import { btnPrimary, btnSecondary } from "@/styles/buttonStyles";

export default function ControlRoomPage() {
    const { tournamentId, divisions, controls } = useTournamentPageContext();
    const room = useControlRoom(tournamentId);
    const [showArchived, setShowArchived] = useState(false);
    const [creating, setCreating] = useState(false);
    const [editingFlowId, setEditingFlowId] = useState<number | null>(null);
    const visible = room.flows.filter((flow) => showArchived || !flow.archivedAt);

    if (!controls) return <p className="text-sm text-ui-text-mute">Control Room is available to tournament staff.</p>;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
                <button type="button" className={btnPrimary} disabled={room.pending} onClick={() => setCreating(true)}>
                    New flow
                </button>
                <button type="button" className={`${btnSecondary} ml-auto`} onClick={() => setShowArchived((value) => !value)}>
                    {showArchived ? "Hide archived" : "Show archived"}
                </button>
            </div>

            {room.query.isLoading ? (
                <p className="text-sm text-ui-text-mute">Loading Control Room…</p>
            ) : room.query.isError ? (
                <p className="text-sm text-state-failed">Unable to load the Control Room.</p>
            ) : visible.length === 0 ? (
                <p className="rounded-xl border border-dashed border-ui-border-strong py-12 text-center text-sm text-ui-text-mute">No flows yet.</p>
            ) : (
                <ControlRoomFlowCarousel>
                    {visible.map((flow) => (
                        <ControlRoomFlowPanel
                            key={flow.id}
                            flow={flow}
                            tournamentId={tournamentId}
                            divisions={divisions}
                            busy={room.pending}
                            onEdit={() => setEditingFlowId(flow.id)}
                            onStart={() => room.start(flow.id)}
                            onPause={() => room.pause(flow.id)}
                            onResume={() => room.resume(flow.id)}
                            onStop={() => room.stop(flow.id)}
                            onArchive={() => room.archive(flow.id)}
                            onUnarchive={() => room.unarchive(flow.id)}
                            onStartFrom={(entryId) => room.startFrom(flow.id, entryId)}
                            onUpdateEntryTime={(entryId, minutes) => room.updateEntryTime(flow.id, entryId, minutes)}
                        />
                    ))}
                </ControlRoomFlowCarousel>
            )}

            <LobbyControlCard tournamentId={tournamentId} />

            <ControlRoomEditor
                flowId={editingFlowId}
                onClose={() => setEditingFlowId(null)}
                onSave={async (flowId, version, entries, name, willStartAt, original) => {
                    await room.replaceEntries(flowId, version, entries);
                    if (name !== original.name || willStartAt !== original.willStartAt) await room.update(flowId, name, willStartAt);
                }}
                onDelete={room.remove}
            />
            <CreateControlRoomFlowModal
                tournamentId={tournamentId}
                open={creating}
                onClose={() => setCreating(false)}
                onCreate={room.create}
            />
        </div>
    );
}
