import { ReactNode, useCallback, useRef, useState } from "react";

/**
 * The sidebar column and the edge you drag to widen it.
 *
 * A tree needs more room than a fixed list of links did — a deep branch runs
 * out of width fast — so the column is the reader's to size. The width is not
 * persisted: it is a momentary adjustment for the branch in front of you, not
 * a setting, and restoring a stale one on the next visit would be a surprise.
 *
 * The grip is its own strip rather than a border handle so it has a real touch
 * target, and it lights up on hover so it reads as draggable before it is.
 */

const DEFAULT_WIDTH_PX = 288;
const MIN_WIDTH_PX = 224;
const MAX_WIDTH_PX = 440;

export default function ResizableSidebar({ children }: { children: ReactNode }) {
  const [width, setWidth] = useState(DEFAULT_WIDTH_PX);
  const [dragging, setDragging] = useState(false);
  const columnRef = useRef<HTMLDivElement>(null);

  const resizeTo = useCallback((clientX: number) => {
    const left = columnRef.current?.getBoundingClientRect().left ?? 0;
    setWidth(Math.max(MIN_WIDTH_PX, Math.min(MAX_WIDTH_PX, clientX - left)));
  }, []);

  return (
    <div ref={columnRef} className="hidden shrink-0 border-r border-ui-border md:flex" style={{ width }}>
      <div className="min-w-0 flex-1">{children}</div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        tabIndex={0}
        onPointerDown={(event) => {
          setDragging(true);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!dragging) return;
          resizeTo(event.clientX);
        }}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") setWidth((current) => Math.max(MIN_WIDTH_PX, current - 16));
          if (event.key === "ArrowRight") setWidth((current) => Math.min(MAX_WIDTH_PX, current + 16));
        }}
        className={`w-1 shrink-0 cursor-col-resize transition-colors focus-visible:outline-none focus-visible:bg-state-running ${
          dragging ? "bg-ui-border-strong" : "bg-transparent hover:bg-ui-border-strong"
        }`}
      />
    </div>
  );
}
