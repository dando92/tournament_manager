import BaseModal from "@/shared/components/ui/BaseModal";
import { useStandingModal } from "@/features/match/hooks/useStandingModal";
import { btnPrimary } from "@/styles/buttonStyles";

type StandingModalProps = {
  mode: "add" | "edit";
  open: boolean;
  playerName: string;
  songTitle: string;
  playerId: number;
  /** The round the standing belongs to: the address the save writes to. */
  roundId: number;
  /** The song of that round, used to offer scores the player already has. */
  songId: number;
  initialPercentage?: number;
  initialScore?: number;
  initialScoreId?: number;
  initialIsFailed?: boolean;
  onClose: () => void;
  onSave: (
    playerId: number,
    roundId: number,
    percentage: number,
    score: number,
    isFailed: boolean,
    scoreId?: number,
  ) => void;
};

export default function StandingModal({
  mode,
  open,
  playerName,
  songTitle,
  playerId,
  roundId,
  songId,
  initialPercentage,
  initialScoreId,
  initialIsFailed,
  onClose,
  onSave,
}: StandingModalProps) {
  const {
    percentage,
    isFailed,
    scoreOptions,
    selectedScoreId,
    selectedScore,
    loadingScores,
    isRegisteredScoreMode,
    percentageIsValid,
    canSave,
    normalizedPercentage,
    setPercentage,
    setIsFailed,
    setSelectedScoreId,
  } = useStandingModal({ open, playerId, songId, initialPercentage, initialScoreId, initialIsFailed });

  function handleSave() {
    if (!canSave) return;

    onSave(
      playerId,
      roundId,
      parseFloat(normalizedPercentage),
      0,
      isFailed,
      selectedScoreId ? Number(selectedScoreId) : undefined,
    );
    onClose();
  }

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      title={mode === "add" ? "Add standing" : "Edit standing"}
      footer={
        <div className="flex flex-row gap-2 justify-end">
          <div className="flex flex-row gap-2">
            <button
              type="button"
              className="text-ui-text-soft px-3 py-1.5 rounded hover:underline"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="button" className={btnPrimary} onClick={handleSave} disabled={!canSave}>
              Save
            </button>
          </div>
        </div>
      }
    >
      <p className="text-sm text-ui-text-mute mb-4">
        {playerName} for {songTitle}
      </p>
      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-ui-text-soft">Registered score</label>
          <select
            value={selectedScoreId}
            onChange={(event) => setSelectedScoreId(event.target.value)}
            disabled={loadingScores}
            className="mt-1 block w-full px-3 py-2 border border-ui-border-strong rounded-md shadow-sm focus:outline-none focus:ring-state-running focus:border-ui-border-strong sm:text-sm"
          >
            <option value="">Manual score</option>
            {scoreOptions.map((score) => (
              <option key={score.id} value={score.id}>
                #{score.id} - {score.percentage.toFixed(2)}%{score.isFailed ? " failed" : ""}
              </option>
            ))}
          </select>
        </div>
        {isRegisteredScoreMode && selectedScore ? (
          <div className="rounded-md border border-ui-border bg-ui-raised px-3 py-2 text-sm text-ui-text-soft">
            Using score #{selectedScore.id}: {selectedScore.percentage.toFixed(2)}%
            {selectedScore.isFailed ? " failed" : ""}. Manual fields are hidden while a registered score is selected.
          </div>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-ui-text-soft">Percentage</label>
              <input
                type="text"
                inputMode="decimal"
                value={percentage}
                onChange={(e) => setPercentage(e.target.value)}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-state-running focus:border-ui-border-strong sm:text-sm ${
                  percentageIsValid ? "border-ui-border-strong" : "border-state-failed/30"
                }`}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isFailed"
                checked={isFailed}
                onChange={(e) => setIsFailed(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="isFailed" className="text-sm font-medium text-ui-text-soft">
                Failed
              </label>
            </div>
          </>
        )}
      </div>
    </BaseModal>
  );
}
