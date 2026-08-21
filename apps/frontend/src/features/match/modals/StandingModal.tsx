import { useEffect, useState } from "react";
import BaseModal from "@/shared/components/ui/BaseModal";
import * as MatchesApi from "@/features/match/services/matches.api";
import { btnPrimary } from "@/styles/buttonStyles";

type ScoreOption = {
  id: number;
  percentage: number;
  isFailed: boolean;
};

type StandingModalProps = {
  mode: "add" | "edit";
  open: boolean;
  playerName: string;
  songTitle: string;
  playerId: number;
  songId: number;
  initialPercentage?: number;
  initialScore?: number;
  initialScoreId?: number;
  initialIsFailed?: boolean;
  onClose: () => void;
  onSave: (
    playerId: number,
    songId: number,
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
  songId,
  initialPercentage,
  initialScoreId,
  initialIsFailed,
  onClose,
  onSave,
}: StandingModalProps) {
  const [percentage, setPercentage] = useState("0");
  const [isFailed, setIsFailed] = useState(false);
  const [scoreOptions, setScoreOptions] = useState<ScoreOption[]>([]);
  const [selectedScoreId, setSelectedScoreId] = useState("");
  const [loadingScores, setLoadingScores] = useState(false);

  useEffect(() => {
    if (open) {
      setPercentage(initialPercentage !== undefined ? String(initialPercentage) : "0");
      setIsFailed(initialIsFailed ?? false);
      setSelectedScoreId(initialScoreId ? String(initialScoreId) : "");
    }
  }, [open, initialPercentage, initialScoreId, initialIsFailed]);

  useEffect(() => {
    if (!open) {
      setScoreOptions([]);
      return;
    }

    let cancelled = false;
    setLoadingScores(true);
    MatchesApi.listScores(songId, playerId)
      .then((scores) => {
        if (cancelled) return;

        const options = scores.map((score) => ({
          id: score.id,
          percentage: Number(score.percentage),
          isFailed: score.isFailed,
        }));
        const hasInitialScore = initialScoreId ? options.some((score) => score.id === initialScoreId) : true;
        if (!hasInitialScore && initialScoreId) {
          options.unshift({
            id: initialScoreId,
            percentage: initialPercentage ?? 0,
            isFailed: initialIsFailed ?? false,
          });
        }
        setScoreOptions(options);
      })
      .catch(() => {
        if (!cancelled) setScoreOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingScores(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, songId, playerId, initialScoreId, initialPercentage, initialIsFailed]);

  const isRegisteredScoreMode = selectedScoreId !== "";
  const selectedScore = scoreOptions.find((score) => score.id === Number(selectedScoreId));
  const normalizedPercentage = percentage.trim().replace(",", ".");
  const percentageIsValid =
    /^\d+(?:\.\d{1,2})?$/.test(normalizedPercentage) &&
    Number(normalizedPercentage) >= 0 &&
    Number(normalizedPercentage) <= 100;
  const canSave = isRegisteredScoreMode ? Boolean(selectedScore) : percentageIsValid;

  useEffect(() => {
    if (!selectedScore) return;
    setPercentage(String(selectedScore.percentage));
    setIsFailed(selectedScore.isFailed);
  }, [selectedScore]);

  function handleSave() {
    if (!canSave) return;

    onSave(
      playerId,
      songId,
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
