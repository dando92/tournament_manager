import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPenToSquare, faRotateLeft, faStickyNote, faTowerBroadcast, faTrash, faUserPlus } from "@fortawesome/free-solid-svg-icons";
import { Match, MatchCommitState } from "@/features/match/types/Match";
import { getActiveLabel, getMatchProgressLabel, getMatchProgressStatus, type MatchProgress } from "@/features/match/utils/matchStatus";
import { StatusBadge } from "@/shared/components/ui/StatusIcon";
import ActionsMenu from "@/shared/components/ui/ActionsMenu";
import MusicPlusIcon from "@/shared/components/ui/MusicPlusIcon";
import StatusDot from "@/shared/components/ui/StatusDot";

type Props = {
  match: Match;
  controls: boolean;
  commitState: MatchCommitState;
  progress: MatchProgress;
  onOpenEditNotes: () => void;
  onDeleteMatch: (matchId: number) => void;
  onOpenAddSong: () => void;
  onOpenAddPlayer: () => void;
  onRenameMatch?: (matchId: number, name: string) => void;
  canEditAdvancementRules?: boolean;
  onEditAdvancementRules?: () => void;
  onToggleActive: () => void;
  onCommitMatch: () => void;
  onReopenMatch: () => void;
};

/** Vertical touch area on phones, where the compact button is under the touch-target size. */
const touchAreaClass = "relative before:absolute before:inset-x-0 before:-inset-y-2 before:content-[''] sm:before:hidden";

export default function MatchHeader({
  match,
  controls,
  commitState,
  progress,
  onOpenEditNotes,
  onDeleteMatch,
  onOpenAddSong,
  onOpenAddPlayer,
  onRenameMatch,
  canEditAdvancementRules = false,
  onEditAdvancementRules,
  onToggleActive,
  onCommitMatch,
  onReopenMatch,
}: Props) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const isMatchEnded = Boolean(match.matchResult);
  const canAddSong = (match.entrants?.length ?? 0) > 0;
  const canToggleActive = !isMatchEnded || match.active;

  useEffect(() => {
    if (isRenaming) inputRef.current?.focus();
  }, [isRenaming]);

  function startRename() {
    setRenameValue(match.name);
    setIsRenaming(true);
  }

  function commitRename() {
    const trimmed = renameValue.trim();
    setIsRenaming(false);
    if (trimmed && trimmed !== match.name && onRenameMatch) {
      onRenameMatch(match.id, trimmed);
    }
  }

  return (
    <div className="flex items-start justify-between gap-3 mb-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <StatusDot on={match.active} label={getActiveLabel(match.active)} />
          {controls && isRenaming ? (
            <input
              ref={inputRef}
              className="text-base font-semibold text-ui-text border-b border-ui-border-strong outline-none bg-transparent w-40"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") setIsRenaming(false);
              }}
            />
          ) : (
            <h3
              className={`text-base font-semibold text-ui-text ${controls ? "cursor-pointer hover:text-ui-text transition-colors" : ""}`}
              onClick={controls ? startRename : undefined}
              title={controls ? "Click to rename" : undefined}
            >
              {match.name}
            </h3>
          )}
          {controls ? (
            <button
              onClick={onOpenEditNotes}
              title={match.notes || "Add notes"}
              className={`text-sm ${match.notes ? "text-state-pending hover:text-state-pending/80" : "text-ui-text-mute hover:text-ui-text-soft"}`}
            >
              <FontAwesomeIcon icon={faStickyNote} />
            </button>
          ) : match.notes ? (
            <span title={match.notes} className="text-state-pending cursor-help text-sm">
              <FontAwesomeIcon icon={faStickyNote} />
            </span>
          ) : null}
        </div>
        {match.subtitle && (
          <p className="text-xs text-ui-text-mute mt-0.5">{match.subtitle}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center justify-end gap-3">
        {/* Visible to everyone: how far the result is from final is not a
            staff-only fact. Only the button that changes it is. */}
        <StatusBadge status={getMatchProgressStatus(progress)} label={getMatchProgressLabel(progress)} />

        {controls && (
          <>
            {commitState !== "Completed" && (
            <button
              type="button"
              onClick={onCommitMatch}
              disabled={commitState === "Disabled"}
              title={commitState === "Disabled" ? "Every score must be filled in before the match can be committed" : undefined}
              className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${touchAreaClass} ${
                commitState === "Disabled"
                  ? "cursor-not-allowed border-ui-border bg-ui-raised text-ui-text-mute"
                  : "cursor-pointer border-state-pending/30 bg-state-pending/10 text-ui-text-soft hover:bg-state-pending/10"
              }`}
            >
              Commit
            </button>
            )}
          <ActionsMenu
            title="Match actions"
            items={[
              {
                key: "active",
                label: match.active ? "Set not active" : "Set active",
                icon: faTowerBroadcast,
                disabled: !canToggleActive,
                onSelect: onToggleActive,
              },
              {
                key: "add-player",
                label: "Add player",
                icon: faUserPlus,
                hidden: isMatchEnded,
                className: "sm:hidden",
                onSelect: onOpenAddPlayer,
              },
              {
                key: "add-song",
                label: "Add song",
                icon: <MusicPlusIcon />,
                hidden: isMatchEnded,
                disabled: !canAddSong,
                className: "sm:hidden",
                onSelect: onOpenAddSong,
              },
              {
                key: "advancement",
                label: "Edit advancement rules",
                icon: faPenToSquare,
                hidden: isMatchEnded || !canEditAdvancementRules,
                onSelect: () => onEditAdvancementRules?.(),
              },
              {
                key: "reopen",
                label: "Re-open match",
                icon: faRotateLeft,
                hidden: commitState !== "Completed",
                onSelect: onReopenMatch,
              },
              {
                key: "delete",
                label: "Delete match",
                icon: faTrash,
                danger: true,
                onSelect: () => onDeleteMatch(match.id),
                confirm: {
                  message: `Delete match "${match.name}"? This cannot be undone.`,
                  confirmText: "Delete match",
                },
              },
            ]}
          />
          </>
        )}
      </div>
    </div>
  );
}
