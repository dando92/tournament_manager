import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPenToSquare, faRotateLeft, faStickyNote, faTowerBroadcast, faTrash, faUserPlus } from "@fortawesome/free-solid-svg-icons";
import { Match, MatchCommitState } from "@/features/match/types/Match";
import { getActiveLabel, getCommitBadgeClass } from "@/features/match/utils/matchStatus";
import ActionsMenu from "@/shared/components/ui/ActionsMenu";
import MusicPlusIcon from "@/shared/components/ui/MusicPlusIcon";
import StatusDot from "@/shared/components/ui/StatusDot";

type Props = {
  match: Match;
  controls: boolean;
  commitState: MatchCommitState;
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
              className="text-base font-semibold text-gray-800 border-b border-primary-dark outline-none bg-transparent w-40"
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
              className={`text-base font-semibold text-gray-800 ${controls ? "cursor-pointer hover:text-primary-dark transition-colors" : ""}`}
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
              className={`text-sm ${match.notes ? "text-amber-500 hover:text-amber-700" : "text-gray-300 hover:text-gray-500"}`}
            >
              <FontAwesomeIcon icon={faStickyNote} />
            </button>
          ) : match.notes ? (
            <span title={match.notes} className="text-amber-400 cursor-help text-sm">
              <FontAwesomeIcon icon={faStickyNote} />
            </span>
          ) : null}
        </div>
        {match.subtitle && (
          <p className="text-xs text-gray-400 mt-0.5">{match.subtitle}</p>
        )}
      </div>
      {controls && (
        <div className="flex items-center justify-end gap-3 shrink-0">
          {commitState === "Completed" ? (
            <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${getCommitBadgeClass("Completed")}`}>
              Completed
            </span>
          ) : (
            <button
              type="button"
              onClick={onCommitMatch}
              disabled={commitState === "Disabled"}
              title={commitState === "Disabled" ? "Every score must be filled in before the match can be committed" : undefined}
              className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${touchAreaClass} ${
                commitState === "Disabled"
                  ? "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400"
                  : "cursor-pointer border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
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
        </div>
      )}
    </div>
  );
}
