import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faStickyNote, faUserPlus } from "@fortawesome/free-solid-svg-icons";
import { Match } from "@/features/match/types/Match";
import DeleteConfirmButton from "@/shared/components/ui/DeleteConfirmButton";
import MusicPlusIcon from "@/shared/components/ui/MusicPlusIcon";

type Props = {
  match: Match;
  controls: boolean;
  onOpenEditNotes: () => void;
  onDeleteMatch: (matchId: number) => void;
  onOpenAddSong: () => void;
  onOpenAddPlayer: () => void;
  onRenameMatch?: (matchId: number, name: string) => void;
  editMode?: boolean;
  canEditRoutes?: boolean;
  onEditRoutes?: () => void;
  onSaveRoutes?: () => void;
  onCancelRoutes?: () => void;
};

export default function MatchHeader({
  match,
  controls,
  onOpenEditNotes,
  onDeleteMatch,
  onOpenAddSong,
  onOpenAddPlayer,
  onRenameMatch,
  editMode = false,
  canEditRoutes = false,
  onEditRoutes,
  onSaveRoutes,
  onCancelRoutes,
}: Props) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [mobileAddMenuOpen, setMobileAddMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const matchState = match.state ?? (match.matchResult ? "Completed" : "NotActive");
  const isMatchEnded = matchState === "Completed";
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
          {controls && !isMatchEnded && (
            editMode ? (
              <>
                <button
                  onClick={onSaveRoutes}
                  className="text-xs text-white bg-green-600 hover:bg-green-700 font-medium rounded px-2 py-0.5 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={onCancelRoutes}
                  className="text-xs text-gray-600 hover:text-gray-800 font-medium border border-gray-200 rounded px-2 py-0.5 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : canEditRoutes ? (
              <button
                onClick={onEditRoutes}
                className="text-xs text-primary-dark font-medium border border-primary-dark/30 rounded px-2 py-0.5 hover:bg-primary-dark/10 transition-colors"
              >
                Edit routes
              </button>
            ) : null
          )}
        </div>
        {match.subtitle && (
          <p className="text-xs text-gray-400 mt-0.5">{match.subtitle}</p>
        )}
      </div>
      {controls && (
        <div className="flex items-center justify-end gap-3 shrink-0">
          {!isMatchEnded && (
            <>
              <button
                onClick={onOpenAddPlayer}
                title="Add player"
                className="hidden sm:inline-flex items-center gap-1 text-green-700 hover:text-green-900 text-sm font-medium"
              >
                <FontAwesomeIcon icon={faUserPlus} />
                <span>Add player</span>
              </button>
              {canAddSong && (
                <button
                  onClick={onOpenAddSong}
                  title="Add song/round"
                  className="hidden sm:inline-flex items-center gap-1 text-green-700 hover:text-green-900 text-sm font-medium"
                >
                  <MusicPlusIcon />
                  <span>Add song</span>
                </button>
              )}
              <div className="relative sm:hidden">
                <button
                  type="button"
                  onClick={() => setMobileAddMenuOpen((value) => !value)}
                  title="Add"
                  className="inline-flex items-center justify-center text-green-700 hover:text-green-900"
                >
                  <FontAwesomeIcon icon={faPlus} />
                </button>
                {mobileAddMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMobileAddMenuOpen(false)} />
                    <div className="absolute right-0 top-full z-20 mt-1 min-w-[160px] rounded border border-gray-200 bg-white shadow-lg">
                      <button
                        type="button"
                        onClick={() => {
                          setMobileAddMenuOpen(false);
                          onOpenAddPlayer();
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-green-700 hover:bg-gray-50 hover:text-green-900"
                      >
                        <FontAwesomeIcon icon={faUserPlus} />
                        Add player
                      </button>
                      <button
                        type="button"
                        disabled={!canAddSong}
                        onClick={() => {
                          setMobileAddMenuOpen(false);
                          onOpenAddSong();
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-green-700 hover:bg-gray-50 hover:text-green-900 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <MusicPlusIcon />
                        Add song
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
          <DeleteConfirmButton
            onConfirm={() => onDeleteMatch(match.id)}
            title="Delete match"
            className="text-sm"
            confirmMessage={`Delete match "${match.name}"?`}
          />
        </div>
      )}
    </div>
  );
}
