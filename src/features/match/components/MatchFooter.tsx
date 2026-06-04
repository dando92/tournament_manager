import { MatchState } from "@/features/match/types/Match";

type MatchFooterProps = {
  state: MatchState;
  onToggleState: () => void;
};

export default function MatchFooter({ state, onToggleState }: MatchFooterProps) {
  const stateButtonLabel = {
    NotActive: "Click to activate",
    Active: "Active",
    Pending: "Commit match",
    Completed: "Re-open match",
  }[state];
  const stateButtonClass = {
    NotActive: "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100",
    Active: "border-green-200 bg-green-50 text-green-800 hover:bg-green-100",
    Pending: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
    Completed: "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100",
  }[state];

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={onToggleState}
        className={`w-full rounded-md border px-3 py-2 text-center text-xs font-semibold transition-colors cursor-pointer ${stateButtonClass}`}
      >
        {stateButtonLabel}
      </button>
    </div>
  );
}
