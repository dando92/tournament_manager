import { useCallback, useEffect, useRef } from "react";

/**
 * The touch equivalent of a right click.
 *
 * A phone has no context-menu button, so the same menu is reached by holding.
 * Two things make the difference between this working and being unusable: the
 * press is cancelled as soon as the finger travels, otherwise every scroll over
 * a list opens a menu; and the browser's own long-press behaviour — the
 * selection callout and the native menu — is suppressed while the gesture is
 * armed.
 *
 * Mouse and pen are ignored on purpose. They already have a right click, and
 * arming this for them would fire a menu whenever someone rests the cursor.
 */

const HOLD_MS = 500;
const TRAVEL_TOLERANCE_PX = 8;

export function useLongPress(onLongPress: (x: number, y: number) => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
  }, []);

  useEffect(() => cancel, [cancel]);

  useEffect(() => {
    /* A press that is still armed must not also scroll away under the menu. */
    window.addEventListener("scroll", cancel, true);
    return () => window.removeEventListener("scroll", cancel, true);
  }, [cancel]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (event.pointerType !== "touch") return;
      const { clientX, clientY } = event;
      origin.current = { x: clientX, y: clientY };
      timer.current = setTimeout(() => {
        timer.current = null;
        if (navigator.vibrate) navigator.vibrate(8);
        onLongPress(clientX, clientY);
      }, HOLD_MS);
    },
    [onLongPress],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!timer.current || !origin.current) return;
      const travelled =
        Math.abs(event.clientX - origin.current.x) > TRAVEL_TOLERANCE_PX ||
        Math.abs(event.clientY - origin.current.y) > TRAVEL_TOLERANCE_PX;
      if (travelled) cancel();
    },
    [cancel],
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: cancel,
    onPointerCancel: cancel,
    /** Applied to the element so the native callout never competes with ours. */
    className: "select-none touch-pan-y",
  };
}
