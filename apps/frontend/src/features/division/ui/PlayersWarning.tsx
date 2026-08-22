type PlayersWarningProps = {
  warnings: string[];
};

export default function PlayersWarning({ warnings }: PlayersWarningProps) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <div className="bg-state-pending/10 border border-state-pending/30 rounded px-3 py-2 text-sm text-ui-text-soft">
      The following players already existed and were linked:{" "}
      <span className="font-semibold">{warnings.join(", ")}</span>
    </div>
  );
}
