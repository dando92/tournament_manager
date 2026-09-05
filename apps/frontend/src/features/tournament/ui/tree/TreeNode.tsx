import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { faChevronRight, faEllipsis } from "@fortawesome/free-solid-svg-icons";
import StatusIcon from "@/shared/components/ui/StatusIcon";
import type { Status } from "@/shared/components/ui/status";
import { useLongPress } from "@/shared/hooks/useLongPress";

/**
 * One row of the tree.
 *
 * Two things about it are deliberate. A row carries either a neutral icon or a
 * status glyph, never both: a destination says what it is, a branch says what
 * it is doing. And for a pointer the whole row activates, because a tree that
 * distinguishes "clicked the arrow" from "clicked the label" is the single most
 * reliable way to frustrate someone.
 *
 * Touch is where that stops being true. There the tree is a page of its own, so
 * activating a branch navigates away from it and a mis-aimed tap costs the
 * whole tree rather than one click. A branch that can be opened separately
 * therefore gives its chevron a target of its own below `md`, grown with a
 * pseudo-element so the indentation the tree is read by does not move.
 *
 * The actions are reachable three ways for one reason each: right click is what
 * a pointer expects, the overflow button is how anyone discovers the actions
 * exist, and a long press is the only one of the three a phone has.
 */

const INDENT_PX = 13;
const BASE_PADDING_PX = 6;

/** Touch-sized without changing layout: the icon keeps its width, the hit area does not. */
const TOUCH_TARGET = "h-9 w-9 -my-2 md:my-0 md:h-5 md:w-5";

type TreeNodeProps = {
  label: string;
  depth: number;
  /** Neutral icon for a destination. Mutually exclusive with `status`. */
  icon?: IconDefinition;
  /** Status glyph for a structural branch. Mutually exclusive with `icon`. */
  status?: Status;
  expandable?: boolean;
  expanded?: boolean;
  selected?: boolean;
  /** Trailing count, for a pool that says how many matches it holds. */
  count?: number;
  strong?: boolean;
  onActivate: (deep: boolean) => void;
  /** Expanding without activating. Only a branch whose row navigates needs it. */
  onToggle?: () => void;
  onOpenMenu?: (x: number, y: number) => void;
  /** An always-visible action next to the overflow button, for the gear. */
  extraAction?: { icon: IconDefinition; title: string; onSelect: () => void };
};

export default function TreeNode({
  label,
  depth,
  icon,
  status,
  expandable = false,
  expanded = false,
  selected = false,
  count,
  strong = false,
  onActivate,
  onToggle,
  onOpenMenu,
  extraAction,
}: TreeNodeProps) {
  const longPress = useLongPress((x, y) => onOpenMenu?.(x, y));

  const openMenuFromButton = (event: React.MouseEvent) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    onOpenMenu?.(rect.left, rect.bottom + 4);
  };

  const chevron = (
    <FontAwesomeIcon
      icon={faChevronRight}
      className={`text-[10px] text-ui-text-mute transition-transform ${expanded ? "rotate-90" : ""} ${
        expandable ? "" : "invisible"
      }`}
    />
  );

  return (
    <div
      role="treeitem"
      tabIndex={0}
      aria-expanded={expandable ? expanded : undefined}
      aria-selected={selected}
      title={label}
      onClick={(event) => onActivate(event.altKey)}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onActivate(event.altKey);
      }}
      onContextMenu={(event) => {
        if (!onOpenMenu) return;
        event.preventDefault();
        onOpenMenu(event.clientX, event.clientY);
      }}
      {...longPress}
      style={{ paddingLeft: BASE_PADDING_PX + depth * INDENT_PX }}
      className={`group flex w-full cursor-pointer items-center gap-2 rounded border-l-[3px] py-2.5 pr-1.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ui-accent md:py-1.5 ${
        longPress.className
      } ${
        selected
          ? "border-ui-accent bg-ui-selected font-semibold text-ui-text"
          : "border-transparent text-ui-text-soft hover:bg-ui-raised hover:text-ui-text"
      }`}
    >
      {expandable && onToggle ? (
        <button
          type="button"
          aria-hidden
          tabIndex={-1}
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
          className="relative w-2.5 shrink-0 after:absolute after:-inset-y-3 after:-left-4 after:-right-2 md:pointer-events-none md:after:content-none"
        >
          {chevron}
        </button>
      ) : (
        <span className="w-2.5 shrink-0">{chevron}</span>
      )}

      {status ? (
        <StatusIcon status={status} />
      ) : icon ? (
        <FontAwesomeIcon
          icon={icon}
          className={`w-4 shrink-0 text-xs ${selected ? "text-ui-text-soft" : "text-ui-text-mute"}`}
        />
      ) : null}

      <span className={`min-w-0 flex-1 truncate ${strong ? "font-semibold text-ui-text" : ""}`}>{label}</span>

      {count !== undefined && <span className="shrink-0 text-[11px] tabular-nums text-ui-text-mute">{count}</span>}

      {extraAction && (
        <button
          type="button"
          title={extraAction.title}
          aria-label={extraAction.title}
          onClick={(event) => {
            event.stopPropagation();
            extraAction.onSelect();
          }}
          className={`flex ${TOUCH_TARGET} shrink-0 items-center justify-center rounded text-xs text-ui-text-mute opacity-100 transition hover:bg-ui-border hover:text-ui-text sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100`}
        >
          <FontAwesomeIcon icon={extraAction.icon} />
        </button>
      )}

      {onOpenMenu && (
        <button
          type="button"
          title="Actions"
          aria-label={`Actions for ${label}`}
          onClick={openMenuFromButton}
          className={`flex ${TOUCH_TARGET} shrink-0 items-center justify-center rounded text-xs text-ui-text-mute transition hover:bg-ui-border hover:text-ui-text sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 ${
            selected ? "opacity-100" : "opacity-100 sm:opacity-0"
          }`}
        >
          <FontAwesomeIcon icon={faEllipsis} />
        </button>
      )}
    </div>
  );
}
