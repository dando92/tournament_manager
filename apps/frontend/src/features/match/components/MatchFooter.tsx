import { MatchCommitState } from "@/features/match/types/Match";

type MatchFooterProps = {
  active: boolean;
  activeDisabled?: boolean;
  commitState: MatchCommitState;
  onToggleActive: () => void;
  onCommitOrReopen: () => void;
};

export default function MatchFooter({ active, activeDisabled = false, commitState, onToggleActive, onCommitOrReopen }: MatchFooterProps) {
  const activeButtonLabel = active ? "Active" : "Click to activate";
  const activeButtonClass = active
    ? "border-green-200 bg-green-50 text-green-800 hover:bg-green-100"
    : `border-gray-200 bg-gray-50 ${activeDisabled ? "text-gray-400 cursor-not-allowed" : "text-gray-700 hover:bg-gray-100"}`;

  const resultButtonLabel = commitState === "Completed" ? "Re-open match" : "Commit match";
  const resultButtonClass = {
    Disabled: "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed",
    Pending: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
    Completed: "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100",
  }[commitState];

  return (
    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
      <button
        type="button"
        onClick={onToggleActive}
        disabled={activeDisabled}
        className={`w-full rounded-md border px-3 py-2 text-center text-xs font-semibold transition-colors ${activeDisabled ? "" : "cursor-pointer"} ${activeButtonClass}`}
      >
        {activeButtonLabel}
      </button>
      <button
        type="button"
        onClick={onCommitOrReopen}
        disabled={commitState === "Disabled"}
        className={`w-full rounded-md border px-3 py-2 text-center text-xs font-semibold transition-colors ${resultButtonClass}`}
      >
        {resultButtonLabel}
      </button>
    </div>
  );
}
