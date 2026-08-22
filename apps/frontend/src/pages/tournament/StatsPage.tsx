/**
 * The tournament's numbers — nothing, for now.
 *
 * What used to be here read the whole tournament graph over
 * `GET /divisions?tournamentId=` and recomputed every total in the browser: a
 * table of every score a player had run, plus three counters taken from the
 * overview. Both were built from what the API happened to return rather than
 * from a question anyone had asked, so the page is empty until there is an
 * answer worth showing. FQ-016 records the decision.
 */
export default function StatsPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 py-12 text-center">
      <p className="text-sm text-ui-text-mute">No statistics yet.</p>
      <p className="text-xs text-ui-text-mute">
        This page is being rebuilt around the numbers a tournament actually needs.
      </p>
    </div>
  );
}
