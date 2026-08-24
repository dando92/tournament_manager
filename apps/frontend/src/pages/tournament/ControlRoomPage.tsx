import { useState } from "react";

import { useTournamentPageContext } from "@/features/tournament/model/TournamentPageContext";
import { useControlRoom } from "@/features/control-room/model/useControlRoom";
import ControlRoomFlowPanel from "@/features/control-room/ui/ControlRoomFlowPanel";
import ControlRoomFlowCarousel from "@/features/control-room/ui/ControlRoomFlowCarousel";
import ControlRoomEditor from "@/features/control-room/ui/ControlRoomEditor";
import LobbyControlCard from "@/features/control-room/ui/LobbyControlCard";
import { btnPrimary, btnSecondary, focusRing } from "@/styles/buttonStyles";

export default function ControlRoomPage() {
    const { tournamentId, divisions, controls } = useTournamentPageContext();
    const room = useControlRoom(tournamentId);
    const [showArchived, setShowArchived] = useState(false);
    const [newName, setNewName] = useState("");
    const [editingFlowId, setEditingFlowId] = useState<number | null>(null);
    const visible = room.flows.filter((flow) => showArchived || !flow.archivedAt);

    if (!controls) return <p className="text-sm text-ui-text-mute">Control Room is available to tournament staff.</p>;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
                <input
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    placeholder="New flow name"
                    className={`min-w-0 flex-1 rounded border border-ui-border bg-ui-canvas px-3 py-2 text-sm sm:max-w-xs ${focusRing}`}
                />
                <button
                    type="button"
                    className={btnPrimary}
                    disabled={!newName.trim() || room.pending}
                    onClick={() => room.create(newName.trim()).then(() => setNewName(""))}
                >
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
                        />
                    ))}
                </ControlRoomFlowCarousel>
            )}

            <LobbyControlCard tournamentId={tournamentId} />

            <ControlRoomEditor
                flowId={editingFlowId}
                onClose={() => setEditingFlowId(null)}
                onSave={async (flowId, version, matchIds, name, originalName) => {
                    await room.replaceEntries(flowId, version, matchIds);
                    if (name !== originalName) await room.rename(flowId, name);
                }}
                onDelete={room.remove}
            />
        </div>
    );
}
