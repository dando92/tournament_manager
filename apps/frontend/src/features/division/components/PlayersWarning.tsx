type PlayersWarningProps = {
  warnings: string[];
};

export default function PlayersWarning({ warnings }: PlayersWarningProps) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <div className="bg-yellow-50 border border-yellow-300 rounded px-3 py-2 text-sm text-yellow-800">
      The following players already existed and were linked:{" "}
      <span className="font-semibold">{warnings.join(", ")}</span>
    </div>
  );
}
