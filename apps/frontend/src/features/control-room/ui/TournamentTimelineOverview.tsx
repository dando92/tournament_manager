import { useEffect, useMemo, useRef, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faChevronLeft, faChevronRight, faChevronUp } from "@fortawesome/free-solid-svg-icons";
import type { ControlRoomFlowDto } from "@tournament-manager/contracts";

import { getDivisionSummary } from "@/features/division/api/division.api";
import { divisionKeys } from "@/features/division/api/division.keys";
import type { Division } from "@/features/division/model/types";
import { buildTournamentTimeline, timingStatusLabel, type TournamentTimelineEntry } from "@/features/control-room/model/tournamentTimeline";
import ReadOnlyMatchCard from "@/features/match/ui/ReadOnlyMatchCard";
import type { TournamentDivisionOption } from "@/features/tournament/model/types";
import { btnGhost, focusRing } from "@/styles/buttonStyles";

type Props = {
    flows: ControlRoomFlowDto[];
    divisions: TournamentDivisionOption[];
};

export default function TournamentTimelineOverview({ flows, divisions }: Props) {
    const [flowIndex, setFlowIndex] = useState(() => initialFlowIndex(flows));
    const wheelLocked = useRef(false);
    const selectorListRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setFlowIndex((current) => Math.min(current, Math.max(0, flows.length - 1)));
    }, [flows.length]);

    useEffect(() => {
        const list = selectorListRef.current;
        const button = list?.querySelector<HTMLElement>(`[data-flow-index="${flowIndex}"]`);
        if (!list || !button) return;
        if (button.offsetTop < list.scrollTop) list.scrollTop = button.offsetTop;
        if (button.offsetTop + button.offsetHeight > list.scrollTop + list.clientHeight) {
            list.scrollTop = button.offsetTop + button.offsetHeight - list.clientHeight;
        }
    }, [flowIndex]);

    function moveFlow(direction: -1 | 1) {
        setFlowIndex((current) => clamp(current + direction, 0, flows.length - 1));
    }

    if (flows.length === 0) {
        return <p className="rounded-xl border border-dashed border-ui-border-strong py-16 text-center text-sm text-ui-text-mute">No tournament flow is available yet.</p>;
    }

    const flow = flows[flowIndex];
    return (
        <section
            className="min-w-0 sm:grid sm:h-[calc(100dvh-4rem)] sm:min-h-[32rem] sm:grid-cols-[minmax(0,1fr)_10rem]"
        >
            <FlowTimeline key={flow.id} flow={flow} divisions={divisions} flowIndex={flowIndex} flowCount={flows.length} onMoveFlow={moveFlow} />
            <nav
                aria-label="Tournament flows"
                className="hidden h-full min-h-0 flex-col border-l border-ui-border bg-ui-sidebar overscroll-contain sm:flex"
                onWheel={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (wheelLocked.current || Math.abs(event.deltaY) < 4) return;
                    wheelLocked.current = true;
                    moveFlow(event.deltaY > 0 ? 1 : -1);
                    window.setTimeout(() => { wheelLocked.current = false; }, 180);
                }}
            >
                <button type="button" aria-label="Previous flow" className={`${btnGhost} rounded-none`} disabled={flowIndex === 0} onClick={() => moveFlow(-1)}>
                    <FontAwesomeIcon icon={faChevronUp} />
                </button>
                <div ref={selectorListRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-2 [scrollbar-width:none]">
                    {flows.map((candidate, index) => (
                        <button
                            key={candidate.id}
                            type="button"
                            data-flow-index={index}
                            aria-current={index === flowIndex ? "true" : undefined}
                            onClick={() => setFlowIndex(index)}
                            className={`flex min-h-16 w-full items-center justify-center border-l-[3px] px-2 py-3 text-left transition-colors sm:justify-start sm:px-3 ${focusRing} ${
                                index === flowIndex
                                    ? "border-ui-accent text-ui-text"
                                    : "border-transparent text-ui-text-mute hover:text-ui-text"
                            }`}
                        >
                            <span className="hidden min-w-0 sm:block">
                                <span className="block truncate text-sm font-semibold">{candidate.name}</span>
                                <span className="mt-0.5 block text-xs capitalize">{candidate.status}</span>
                            </span>
                            <span className="text-xs font-bold sm:hidden">{index + 1}</span>
                        </button>
                    ))}
                </div>
                <button type="button" aria-label="Next flow" className={`${btnGhost} rounded-none`} disabled={flowIndex === flows.length - 1} onClick={() => moveFlow(1)}>
                    <FontAwesomeIcon icon={faChevronDown} />
                </button>
            </nav>
        </section>
    );
}

function FlowTimeline({
    flow,
    divisions,
    flowIndex,
    flowCount,
    onMoveFlow,
}: {
    flow: ControlRoomFlowDto;
    divisions: TournamentDivisionOption[];
    flowIndex: number;
    flowCount: number;
    onMoveFlow: (direction: -1 | 1) => void;
}) {
    const [now, setNow] = useState(() => new Date());
    const model = useMemo(() => buildTournamentTimeline(flow, now), [flow, now]);
    const initialIndex = Math.max(0, flow.entries.findIndex((entry) => entry.id === flow.currentEntryId));
    const [selectedIndex, setSelectedIndex] = useState(initialIndex);
    const [dragOffset, setDragOffset] = useState(0);
    const [dragging, setDragging] = useState(false);
    const pointerStart = useRef({ x: 0, y: 0 });
    const dragAxis = useRef<"pending" | "horizontal" | "vertical">("pending");
    const viewportRef = useRef<HTMLDivElement>(null);
    const [viewportWidth, setViewportWidth] = useState(900);
    const divisionIds = [...new Set(flow.entries.map((entry) => divisionIdOf(divisions, entry.match.phaseGroupId)).filter((id): id is number => id !== null))];
    const divisionQueries = useQueries({
        queries: divisionIds.map((divisionId) => ({ queryKey: divisionKeys.summary(divisionId), queryFn: () => getDivisionSummary(divisionId) })),
    });
    const divisionById = new Map<number, Division>();
    divisionIds.forEach((id, index) => {
        const division = divisionQueries[index]?.data;
        if (division) divisionById.set(id, division);
    });

    useEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport) return;
        const observer = new ResizeObserver(([entry]) => setViewportWidth(entry.contentRect.width));
        observer.observe(viewport);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const interval = window.setInterval(() => setNow(new Date()), 60_000);
        return () => window.clearInterval(interval);
    }, []);

    const cardWidth = Math.min(760, Math.max(250, viewportWidth * (viewportWidth < 640 ? 0.88 : 0.72)));
    const cardGap = viewportWidth < 640 ? 12 : 24;
    const step = cardWidth + cardGap;
    const trackX = viewportWidth / 2 - cardWidth / 2 - selectedIndex * step + dragOffset;
    const currentIndex = flow.entries.findIndex((entry) => entry.id === flow.currentEntryId);

    function beginDrag(event: React.PointerEvent<HTMLDivElement>) {
        if (event.button !== 0) return;
        pointerStart.current = { x: event.clientX, y: event.clientY };
        dragAxis.current = "pending";
        setDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
    }

    function moveDrag(event: React.PointerEvent<HTMLDivElement>) {
        if (!dragging) return;
        const movementX = event.clientX - pointerStart.current.x;
        const movementY = event.clientY - pointerStart.current.y;
        if (dragAxis.current === "pending" && Math.max(Math.abs(movementX), Math.abs(movementY)) >= 8) {
            dragAxis.current = Math.abs(movementX) > Math.abs(movementY) ? "horizontal" : "vertical";
        }
        if (dragAxis.current === "horizontal") setDragOffset(movementX);
    }

    function finishDrag(event: React.PointerEvent<HTMLDivElement>) {
        if (!dragging) return;
        const offset = event.clientX - pointerStart.current.x;
        if (dragAxis.current === "horizontal") {
            const movement = Math.abs(offset) > Math.min(48, step * 0.16) ? (offset < 0 ? 1 : -1) : 0;
            setSelectedIndex((current) => clamp(current + movement, 0, model.entries.length - 1));
        }
        dragAxis.current = "pending";
        setDragOffset(0);
        setDragging(false);
    }

    if (model.entries.length === 0) {
        return (
            <div className="flex min-w-0 flex-col p-5 sm:p-7">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ui-text-mute">Tournament timeline</p>
                <h1 className="mt-1 text-xl font-bold text-ui-text">{flow.name}</h1>
                <p className="my-auto rounded-xl border border-dashed border-ui-border-strong py-16 text-center text-sm text-ui-text-mute">This flow has no matches.</p>
            </div>
        );
    }

    return (
        <div className="min-w-0 overflow-hidden py-2 sm:py-7">
            <header className="flex flex-wrap items-start justify-between gap-2 px-1 sm:gap-3 sm:px-7">
                <div>
                    <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-ui-text-mute sm:text-xs sm:tracking-[0.18em]">Tournament timeline</p>
                    <h1 className="mt-0.5 text-base font-bold text-ui-text sm:mt-1 sm:text-xl">{flow.name}</h1>
                </div>
                <TimingBadge model={model} />
            </header>

            <TimelineRail entries={model.entries} selectedIndex={selectedIndex} currentIndex={currentIndex} dragProgress={step > 0 ? dragOffset / step : 0} viewportWidth={viewportWidth} onSelect={setSelectedIndex} />

            <div className="mb-2 hidden items-center justify-center gap-3 sm:flex">
                <button type="button" aria-label="Previous match" className={`rounded-full border border-ui-border bg-ui-raised p-2 ${focusRing}`} disabled={selectedIndex === 0} onClick={() => setSelectedIndex((index) => index - 1)}>
                    <FontAwesomeIcon icon={faChevronLeft} />
                </button>
                <span className="min-w-14 text-center text-xs font-semibold text-ui-text-mute">{selectedIndex + 1} / {model.entries.length}</span>
                <button type="button" aria-label="Next match" className={`rounded-full border border-ui-border bg-ui-raised p-2 ${focusRing}`} disabled={selectedIndex === model.entries.length - 1} onClick={() => setSelectedIndex((index) => index + 1)}>
                    <FontAwesomeIcon icon={faChevronRight} />
                </button>
            </div>

            <div className="relative">
                <div
                    ref={viewportRef}
                    className={`cursor-grab overflow-hidden touch-pan-y select-none focus-visible:outline-none active:cursor-grabbing ${dragging ? "" : "motion-safe:scroll-smooth"}`}
                    onPointerDown={beginDrag}
                    onPointerMove={moveDrag}
                    onPointerUp={finishDrag}
                    onPointerCancel={finishDrag}
                    onKeyDown={(event) => {
                        if (event.key === "ArrowLeft") setSelectedIndex((index) => clamp(index - 1, 0, model.entries.length - 1));
                        if (event.key === "ArrowRight") setSelectedIndex((index) => clamp(index + 1, 0, model.entries.length - 1));
                    }}
                    tabIndex={0}
                    role="group"
                    aria-label="Match cards"
                >
                    <div
                        className={`flex will-change-transform ${dragging ? "transition-none" : "motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out"}`}
                        style={{ gap: cardGap, transform: `translate3d(${trackX}px, 0, 0)` }}
                    >
                        {model.entries.map((entry, index) => {
                            const visualDistance = Math.abs(index - selectedIndex + dragOffset / step);
                            const scale = Math.max(0.56, 1 - Math.min(visualDistance, 1.5) * 0.3);
                            const divisionId = divisionIdOf(divisions, entry.match.phaseGroupId);
                            const division = divisionId ? divisionById.get(divisionId) : undefined;
                            return (
                                <article
                                    key={entry.id}
                                    aria-hidden={visualDistance > 0.58}
                                    className={`shrink-0 will-change-transform ${dragging ? "transition-none" : "motion-safe:transition-[transform,opacity] motion-safe:duration-300"}`}
                                    style={{ width: cardWidth, opacity: Math.max(0.42, 1 - Math.min(visualDistance, 1.5) * 0.38), transform: `scale(${scale})` }}
                                >
                                    <p className="mb-1 truncate px-1 text-center text-xs font-bold uppercase tracking-wide text-ui-text-mute sm:mb-2 sm:text-sm sm:tracking-wider">{contextLabel(divisions, entry.match.phaseGroupId)}</p>
                                    {division ? <ReadOnlyMatchCard division={division} match={entry.match} allMatches={flow.entries.map((item) => item.match)} /> : <div className="my-3 rounded-xl border border-ui-border bg-ui-raised p-8 text-center text-sm text-ui-text-mute">Loading match…</div>}
                                </article>
                            );
                        })}
                    </div>
                </div>
            </div>
            <nav aria-label="Tournament flows" className="mt-3 flex items-center justify-center gap-3 px-2 sm:hidden">
                <button type="button" aria-label="Previous flow" className={`rounded-full border border-ui-border bg-ui-sidebar p-2 ${focusRing}`} disabled={flowIndex === 0} onClick={() => onMoveFlow(-1)}>
                    <FontAwesomeIcon icon={faChevronLeft} />
                </button>
                <span className="min-w-0 text-center">
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-ui-text-mute">Flow {flowIndex + 1} / {flowCount}</span>
                    <span className="block max-w-40 truncate text-xs font-bold text-ui-text">{flow.name}</span>
                </span>
                <button type="button" aria-label="Next flow" className={`rounded-full border border-ui-border bg-ui-sidebar p-2 ${focusRing}`} disabled={flowIndex === flowCount - 1} onClick={() => onMoveFlow(1)}>
                    <FontAwesomeIcon icon={faChevronRight} />
                </button>
            </nav>
            <p className="mt-2 px-2 text-center text-[11px] leading-4 text-ui-text-mute sm:hidden">Swipe left or right to browse matches</p>
        </div>
    );
}

function TimelineRail({
    entries,
    selectedIndex,
    currentIndex,
    dragProgress,
    viewportWidth,
    onSelect,
}: {
    entries: TournamentTimelineEntry[];
    selectedIndex: number;
    currentIndex: number;
    dragProgress: number;
    viewportWidth: number;
    onSelect: (index: number) => void;
}) {
    const nodeStep = viewportWidth < 640 ? 88 : 116;
    const railWidth = entries.length * nodeStep;
    const railX = -(nodeStep / 2 + selectedIndex * nodeStep) + dragProgress * nodeStep;
    return (
        <div className="relative my-2 overflow-hidden py-2 sm:my-7 sm:py-4">
            <div className="relative left-1/2 flex transition-transform duration-75" style={{ width: railWidth, transform: `translate3d(${railX}px, 0, 0)` }}>
                {entries.map((entry, index) => {
                    const distance = Math.abs(index - selectedIndex + dragProgress);
                    const emphasis = 1 - Math.min(distance, 2) * 0.18;
                    const current = index === currentIndex;
                    const completed = entry.completedAt !== null || (currentIndex >= 0 && index < currentIndex);
                    return (
                        <button
                            key={entry.id}
                            type="button"
                            aria-current={current ? "step" : undefined}
                            aria-pressed={index === selectedIndex}
                            onClick={() => onSelect(index)}
                            className={`relative z-[1] flex shrink-0 flex-col items-center ${focusRing}`}
                            style={{ width: nodeStep, opacity: 0.52 + emphasis * 0.48 }}
                        >
                            <time className="origin-bottom text-xs font-bold text-ui-text motion-safe:transition-transform sm:text-sm" dateTime={entry.displayedStartAt} style={{ transform: `scale(${0.82 + emphasis * 0.3})` }}>
                                {formatTime(entry.displayedStartAt)}
                            </time>
                            <span className="relative mt-3 flex h-4 w-full items-center justify-center">
                                {index < entries.length - 1 && <span className="absolute left-[calc(50%+10px)] top-1/2 h-px w-[calc(100%-20px)] -translate-y-1/2 bg-ui-border-strong" />}
                                <span
                                    className={`relative z-[1] rounded-full border-2 motion-safe:transition-transform ${current ? "border-state-live bg-ui-surface ring-4 ring-state-live/20" : completed ? "border-state-done bg-state-done" : "border-ui-border-strong bg-ui-surface"}`}
                                    style={{ width: 13, height: 13, transform: `scale(${0.8 + emphasis * 0.65})` }}
                                />
                            </span>
                            <span className="mt-1.5 max-w-[78px] truncate text-[9px] text-ui-text-mute sm:mt-2 sm:max-w-[104px] sm:text-[11px]">{entry.match.name}</span>
                            {current && <span className="mt-0.5 text-[8px] font-bold uppercase tracking-wider text-state-live sm:mt-1 sm:text-[9px]">Current</span>}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function TimingBadge({ model }: { model: ReturnType<typeof buildTournamentTimeline> }) {
    const classes = model.timingStatus === "delayed"
        ? "border-state-failed/40 bg-state-failed/10 text-state-failed"
        : model.timingStatus === "ahead"
            ? "border-state-done/40 bg-state-done/10 text-state-done"
            : "border-ui-border-strong bg-ui-raised text-ui-text-soft";
    return <span className={`rounded-full border px-2 py-1 text-[9px] font-bold tracking-wide sm:px-3 sm:py-1.5 sm:text-xs sm:tracking-wider ${classes}`}>{timingStatusLabel(model)}</span>;
}

function initialFlowIndex(flows: ControlRoomFlowDto[]): number {
    const operational = flows.findIndex((flow) => flow.status === "running" || flow.status === "paused");
    return operational >= 0 ? operational : 0;
}

function divisionIdOf(divisions: TournamentDivisionOption[], phaseGroupId: number): number | null {
    return divisions.find((division) => division.phases.some((phase) => phase.phaseGroups?.some((pool) => pool.id === phaseGroupId)))?.id ?? null;
}

function contextLabel(divisions: TournamentDivisionOption[], phaseGroupId: number): string {
    for (const division of divisions) {
        for (const phase of division.phases) {
            const pool = phase.phaseGroups?.find((candidate) => candidate.id === phaseGroupId);
            if (pool) return `${division.name} · ${phase.name} · ${pool.name}`;
        }
    }
    return "Tournament match";
}

function formatTime(value: string): string {
    return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value));
}
