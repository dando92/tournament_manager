import { useEffect, useRef, useState, type PointerEvent, type ReactNode, type WheelEvent } from "react";

const SWIPE_THRESHOLD_PX = 64;
const EDGE_RESISTANCE = 0.28;
const DOT_RADIUS = 2;
const WHEEL_COOLDOWN_MS = 180;

export default function ControlRoomFlowCarousel({ children }: { children: ReactNode[] }) {
    const [index, setIndex] = useState(0);
    const [dragOffset, setDragOffset] = useState(0);
    const [dragging, setDragging] = useState(false);
    const gesture = useRef<{ pointerId: number; startX: number; latestX: number } | null>(null);
    const wheelLockedUntil = useRef(0);
    const lastIndex = children.length - 1;
    const firstVisibleDot = Math.max(0, index - DOT_RADIUS);
    const lastVisibleDot = Math.min(lastIndex, index + DOT_RADIUS);
    const visibleDots = Array.from({ length: lastVisibleDot - firstVisibleDot + 1 }, (_, offset) => firstVisibleDot + offset);

    useEffect(() => {
        setIndex((current) => Math.min(current, Math.max(lastIndex, 0)));
    }, [lastIndex]);

    function moveTo(nextIndex: number) {
        setDragging(false);
        setDragOffset(0);
        setIndex(Math.max(0, Math.min(nextIndex, lastIndex)));
    }

    function startSwipe(event: PointerEvent<HTMLDivElement>) {
        if (event.pointerType !== "touch") return;
        gesture.current = { pointerId: event.pointerId, startX: event.clientX, latestX: event.clientX };
        setDragging(true);
    }

    function updateSwipe(event: PointerEvent<HTMLDivElement>) {
        const current = gesture.current;
        if (!current || current.pointerId !== event.pointerId) return;
        current.latestX = event.clientX;
        const distance = event.clientX - current.startX;
        const beyondStart = index === 0 && distance > 0;
        const beyondEnd = index === lastIndex && distance < 0;
        setDragOffset(beyondStart || beyondEnd ? distance * EDGE_RESISTANCE : distance);
    }

    function finishSwipe(event: PointerEvent<HTMLDivElement>) {
        const current = gesture.current;
        if (!current || current.pointerId !== event.pointerId) return;
        const distance = current.latestX - current.startX;
        gesture.current = null;

        if (distance <= -SWIPE_THRESHOLD_PX && index < lastIndex) {
            moveTo(index + 1);
        } else if (distance >= SWIPE_THRESHOLD_PX && index > 0) {
            moveTo(index - 1);
        } else {
            moveTo(index);
        }
    }

    function scrollDots(event: WheelEvent<HTMLDivElement>) {
        const distance = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
        if (Math.abs(distance) < 4) return;
        event.preventDefault();
        const now = Date.now();
        if (now < wheelLockedUntil.current) return;
        wheelLockedUntil.current = now + WHEEL_COOLDOWN_MS;
        moveTo(index + Math.sign(distance));
    }

    return (
        <section aria-label="Control room flows" className="min-w-0 w-full max-w-full">
            <div
                className="w-full max-w-full touch-pan-y overflow-hidden"
                onPointerDown={startSwipe}
                onPointerMove={updateSwipe}
                onPointerUp={finishSwipe}
                onPointerCancel={finishSwipe}
            >
                <div
                    className={`flex will-change-transform ${dragging ? "transition-none" : "motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out"}`}
                    style={{ transform: `translate3d(calc(${-index * 100}% + ${dragOffset}px), 0, 0)` }}
                >
                    {children.map((child, childIndex) => (
                        <div
                            key={childIndex}
                            aria-hidden={childIndex !== index}
                            {...(childIndex !== index ? { inert: "" } : {})}
                            className="w-full shrink-0"
                        >
                            {child}
                        </div>
                    ))}
                </div>
            </div>

            <div
                role="group"
                aria-label="Choose a control room flow"
                onWheel={scrollDots}
                className="mx-auto mt-3 grid h-7 w-28 grid-cols-5 items-center justify-items-center"
            >
                {visibleDots.map((dotIndex) => {
                    const active = dotIndex === index;
                    return (
                        <button
                            key={dotIndex}
                            type="button"
                            aria-label={`Show flow ${dotIndex + 1} of ${children.length}`}
                            aria-current={active ? "true" : undefined}
                            onClick={() => moveTo(dotIndex)}
                            style={{ gridColumn: dotIndex - index + DOT_RADIUS + 1 }}
                            className={`col-start-auto row-start-1 rounded-full transition-transform duration-150 hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ui-canvas ${
                                active
                                    ? "h-3 w-3 bg-ui-accent shadow-[0_2px_6px_rgb(var(--ui-accent)/0.45)] ring-2 ring-ui-accent/20"
                                    : "h-2 w-2 bg-ui-border-strong"
                            }`}
                        />
                    );
                })}
            </div>
        </section>
    );
}
