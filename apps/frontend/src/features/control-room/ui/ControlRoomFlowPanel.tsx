import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { faPlay } from "@fortawesome/free-solid-svg-icons";
import type { ControlRoomFlowDto } from "@tournament-manager/contracts";

import { getDivisionSummary } from "@/features/division/api/division.api";
import { divisionKeys } from "@/features/division/api/division.keys";
import { useDivisionEntrantsQuery } from "@/features/division/model/useDivisionEntrantsQuery";
import type { TournamentDivisionOption } from "@/features/tournament/model/types";
import { useMatches } from "@/features/match/model/useMatches";
import ConnectedMatchCard from "@/features/match/ui/ConnectedMatchCard";
import { getMatchCommitState } from "@/features/match/model/matchStatus";
import LobbyControlCard from "@/features/control-room/ui/LobbyControlCard";
import { controlRoomInterruptionMessage, controlRoomStaleMessage, controlRoomStatusLabel } from "@/features/control-room/model/controlRoomStatus";
import StatusIcon from "@/shared/components/ui/StatusIcon";
import ContextMenu, { useContextMenu } from "@/shared/components/ui/ContextMenu";
import { btnPrimary, btnSecondary } from "@/styles/buttonStyles";

type Props = {
    flow: ControlRoomFlowDto;
    tournamentId: number;
    divisions: TournamentDivisionOption[];
    busy: boolean;
    onEdit: () => void;
    onStart: () => Promise<void>;
    onPause: () => Promise<void>;
    onResume: () => Promise<void>;
    onStop: () => Promise<void>;
    onArchive: () => Promise<void>;
    onUnarchive: () => Promise<void>;
    onStartFrom: (entryId: number) => Promise<void>;
};

export default function ControlRoomFlowPanel(props: Props) {
    const { flow } = props;
    const { menu, openMenu, closeMenu } = useContextMenu();
    const current = flow.entries.find((entry) => entry.id === flow.currentEntryId) ?? null;
    const staleMessage = controlRoomStaleMessage(flow);
    const interruptionMessage = controlRoomInterruptionMessage(flow);
    const status = flow.status === "completed" ? "done" : flow.staleCode ? "pending" : flow.status === "running" ? "running" : "idle";

    return (
        <section className="rounded-xl border border-ui-border bg-ui-surface p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
                <StatusIcon status={status} />
                <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg font-bold text-ui-text">{flow.name}</h2>
                    <p className="text-sm text-ui-text-mute">{controlRoomStatusLabel(flow)}</p>
                </div>
                <FlowActions {...props} />
            </div>

            {staleMessage && (
                <div className="mt-4 rounded border border-state-pending/30 bg-state-pending/10 px-3 py-2 text-sm text-ui-text-soft">
                    <strong className="text-ui-text">Waiting:</strong> {staleMessage}
                </div>
            )}

            {interruptionMessage && flow.status === "inactive" && (
                <div className="mt-4 rounded border border-state-pending/30 bg-state-pending/10 px-3 py-2 text-sm text-ui-text-soft">
                    <strong className="text-ui-text">Interrupted:</strong> {interruptionMessage}
                </div>
            )}

            {current ? (
                <CurrentMatch flow={flow} tournamentId={props.tournamentId} divisions={props.divisions} />
            ) : (
                <p className="mt-4 rounded border border-dashed border-ui-border-strong py-8 text-center text-sm text-ui-text-mute">
                    {flow.status === "completed" ? "Flow completed." : "No current match."}
                </p>
            )}

            {flow.status !== "completed" && (
                <div className="mt-4">
                    <LobbyControlCard tournamentId={props.tournamentId} />
                </div>
            )}

            <div className="mt-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ui-text-mute">Queue</h3>
                <div className="flex flex-col gap-1">
                    {flow.entries.map((entry) => (
                        <button
                            key={entry.id}
                            type="button"
                            onContextMenu={(event) => {
                                event.preventDefault();
                                openMenu(event.clientX, event.clientY, entry.match.name, [
                                    {
                                        key: "start-here",
                                        label: "Start from here",
                                        icon: faPlay,
                                        disabled: flow.status !== "inactive",
                                        onSelect: () => props.onStartFrom(entry.id),
                                    },
                                ]);
                            }}
                            className={`flex items-center gap-2 rounded px-3 py-2 text-left text-sm ${entry.id === flow.currentEntryId ? "bg-ui-selected font-semibold text-ui-text" : "text-ui-text-soft hover:bg-ui-raised"}`}
                        >
                            <span className="w-6 text-right tabular-nums text-ui-text-mute">{entry.position + 1}</span>
                            <span className="truncate">{entry.match.name}</span>
                        </button>
                    ))}
                    {flow.entries.length === 0 && <p className="text-sm text-ui-text-mute">No matches assigned.</p>}
                </div>
            </div>
            <ContextMenu state={menu} onClose={closeMenu} />
        </section>
    );
}

function FlowActions(props: Props) {
    const { flow, busy } = props;
    return (
        <div className="flex flex-wrap gap-2">
            {flow.status === "inactive" && (
                <>
                    <button type="button" className={btnSecondary} disabled={busy} onClick={props.onEdit}>
                        Edit
                    </button>
                    <button type="button" className={btnPrimary} disabled={busy || flow.entries.length === 0} onClick={() => props.onStart()}>
                        Start
                    </button>
                </>
            )}
            {flow.status === "running" && (
                <>
                    <button type="button" className={btnSecondary} disabled={busy} onClick={() => props.onPause()}>
                        Pause
                    </button>
                    <button type="button" className={btnSecondary} disabled={busy} onClick={() => props.onStop()}>
                        Stop
                    </button>
                </>
            )}
            {flow.status === "paused" && (
                <>
                    <button type="button" className={btnPrimary} disabled={busy} onClick={() => props.onResume()}>
                        Resume
                    </button>
                    <button type="button" className={btnSecondary} disabled={busy} onClick={() => props.onStop()}>
                        Stop
                    </button>
                </>
            )}
            {flow.status === "completed" &&
                (flow.archivedAt ? (
                    <button type="button" className={btnSecondary} disabled={busy} onClick={() => props.onUnarchive()}>
                        Unarchive
                    </button>
                ) : (
                    <button type="button" className={btnSecondary} disabled={busy} onClick={() => props.onArchive()}>
                        Archive
                    </button>
                ))}
        </div>
    );
}

function CurrentMatch({ flow, tournamentId, divisions }: { flow: ControlRoomFlowDto; tournamentId: number; divisions: TournamentDivisionOption[] }) {
    const entry = flow.entries.find((candidate) => candidate.id === flow.currentEntryId);
    const divisionId = entry ? divisionIdOf(divisions, entry.match.phaseGroupId) : null;
    if (!entry || !divisionId) {
        return <p className="mt-4 text-sm text-state-failed">Unable to locate the current match division.</p>;
    }

    return <ConnectedCurrentMatch matchId={entry.match.id} divisionId={divisionId} tournamentId={tournamentId} />;
}

function ConnectedCurrentMatch({ matchId, divisionId, tournamentId }: { matchId: number; divisionId: number; tournamentId: number }) {
    const division = useQuery({ queryKey: divisionKeys.summary(divisionId), queryFn: () => getDivisionSummary(divisionId) });
    const entrants = useDivisionEntrantsQuery(divisionId);
    const matches = useMatches(divisionId);
    const [highlight, setHighlight] = useState({ matchId: null as number | null, phaseGroupId: null as number | null });
    const match = matches.matches.find((candidate) => candidate.id === matchId);

    if (!division.data || !match) return <p className="mt-4 text-sm text-ui-text-mute">Loading current match…</p>;

    return (
        <div className="mt-4">
            {getMatchCommitState(match) === "Pending" && (
                <div className="flex justify-end">
                    <button type="button" className={btnPrimary} onClick={() => matches.actions.commitMatchResult(match.id)}>
                        Commit result
                    </button>
                </div>
            )}
            <ConnectedMatchCard
                match={match}
                division={division.data}
                divisionEntrants={entrants.data ?? []}
                allMatches={matches.matches}
                actions={matches.actions}
                controls
                tournamentId={tournamentId}
                highlight={highlight}
                onHighlight={setHighlight}
            />
        </div>
    );
}

function divisionIdOf(divisions: TournamentDivisionOption[], phaseGroupId: number): number | null {
    return divisions.find((division) => division.phases.some((phase) => phase.phaseGroups?.some((pool) => pool.id === phaseGroupId)))?.id ?? null;
}
