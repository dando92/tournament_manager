import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPencil } from "@fortawesome/free-solid-svg-icons";
import DeleteConfirmButton from "@/shared/components/ui/DeleteConfirmButton";

export type ScoreEntry = {
  scoreId: number;
  score: number;
  percentage: number;
  isFailed: boolean;
};

export type MobileScoreMenuState = {
  songId: number;
  scoreId: number;
  x: number;
  y: number;
  scoreData: ScoreEntry;
  songTitle: string;
};

type MobileScoreActionsMenuProps = {
  menu: MobileScoreMenuState;
  playerId: number;
  playerName: string;
  onClose: () => void;
  onOpenEditStanding: (
    playerId: number,
    songId: number,
    playerName: string,
    songTitle: string,
    scoreId: number,
    percentage: number,
    score: number,
    isFailed: boolean,
  ) => void;
  onDeleteStanding: (playerId: number, songId: number) => void;
};

export default function MobileScoreActionsMenu({
  menu,
  playerId,
  playerName,
  onClose,
  onOpenEditStanding,
  onDeleteStanding,
}: MobileScoreActionsMenuProps) {
  return createPortal(
    <div
      className="sm:hidden fixed z-[9999] min-w-[140px] rounded border border-gray-200 bg-white text-left shadow-lg"
      style={{ left: menu.x, top: menu.y, transform: "translateX(-100%)" }}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => {
          onClose();
          onOpenEditStanding(
            playerId,
            menu.songId,
            playerName,
            menu.songTitle,
            menu.scoreData.scoreId,
            menu.scoreData.percentage,
            menu.scoreData.score,
            menu.scoreData.isFailed,
          );
        }}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-brand-700 hover:bg-gray-50"
      >
        <FontAwesomeIcon icon={faPencil} />
        Edit score
      </button>
      <DeleteConfirmButton
        onConfirm={() => {
          onClose();
          onDeleteStanding(playerId, menu.songId);
        }}
        title="Delete score"
        className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-gray-50"
        iconClassName="text-sm"
        confirmMessage={`Delete ${playerName}'s score for "${menu.songTitle}"?`}
        stopPropagation
      >
        Delete score
      </DeleteConfirmButton>
    </div>,
    document.body,
  );
}
