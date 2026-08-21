import { ReactNode } from "react";
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
 * it is doing. And the whole row activates — there is no separate hit area for
 * the chevron — because a tree that distinguishes "clicked the arrow" from
 * "clicked the label" is the single most reliable way to frustrate someone.
 *
 * The actions are reachable three ways for one reason each: right click is what
 * a pointer expects, the overflow button is how anyone discovers the actions
 * exist, and a long press is the only one of the three a phone has.
 */

const INDENT_PX = 13;
const BASE_PADDING_PX = 6;

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
  /** Sits before the label, for the pin marker on a tournament. */
  leading?: ReactNode;
  onActivate: (deep: boolean) => void;
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
  leading,
  onActivate,
  onOpenMenu,
  extraAction,
}: TreeNodeProps) {
  const longPress = useLongPress((x, y) => onOpenMenu?.(x, y));

  const openMenuFromButton = (event: React.MouseEvent) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    onOpenMenu?.(rect.left, rect.bottom + 4);
  };

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
      className={`group flex w-full cursor-pointer items-center gap-2 rounded py-1.5 pr-1.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-state-running ${
        longPress.className
      } ${
        selected
          ? "bg-ui-selected font-semibold text-ui-text ring-1 ring-inset ring-ui-border-strong"
          : "text-ui-text-soft hover:bg-ui-raised hover:text-ui-text"
      }`}
    >
      <FontAwesomeIcon
        icon={faChevronRight}
        className={`w-2.5 shrink-0 text-[10px] text-ui-text-mute transition-transform ${expanded ? "rotate-90" : ""} ${
          expandable ? "" : "invisible"
        }`}
      />

      {status ? (
        <StatusIcon status={status} />
      ) : icon ? (
        <FontAwesomeIcon
          icon={icon}
          className={`w-4 shrink-0 text-xs ${selected ? "text-ui-text-soft" : "text-ui-text-mute"}`}
        />
      ) : null}

      {leading}

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
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs text-ui-text-mute opacity-100 transition hover:bg-ui-border hover:text-ui-text sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
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
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs text-ui-text-mute transition hover:bg-ui-border hover:text-ui-text sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 ${
            selected ? "opacity-100" : "opacity-100 sm:opacity-0"
          }`}
        >
          <FontAwesomeIcon icon={faEllipsis} />
        </button>
      )}
    </div>
  );
}
