import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPenToSquare, faStickyNote, faTrash, faUserPlus } from "@fortawesome/free-solid-svg-icons";
import { Match } from "@/features/match/types/Match";
import ActionsMenu from "@/shared/components/ui/ActionsMenu";
import MusicPlusIcon from "@/shared/components/ui/MusicPlusIcon";

type Props = {
  match: Match;
  controls: boolean;
  onOpenEditNotes: () => void;
  onDeleteMatch: (matchId: number) => void;
  onOpenAddSong: () => void;
  onOpenAddPlayer: () => void;
  onRenameMatch?: (matchId: number, name: string) => void;
  canEditAdvancementRules?: boolean;
  onEditAdvancementRules?: () => void;
};

export default function MatchHeader({
  match,
  controls,
  onOpenEditNotes,
  onDeleteMatch,
  onOpenAddSong,
  onOpenAddPlayer,
  onRenameMatch,
  canEditAdvancementRules = false,
  onEditAdvancementRules,
}: Props) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const isMatchEnded = Boolean(match.matchResult);
  const canAddSong = (match.entrants?.length ?? 0) > 0;

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
          <ActionsMenu
            title="Match actions"
            items={[
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
