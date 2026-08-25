import { useTournamentPageContext } from "@/features/tournament/model/TournamentPageContext";
import { useControlRoom } from "@/features/control-room/model/useControlRoom";
import TournamentTimelineOverview from "@/features/control-room/ui/TournamentTimelineOverview";

/**
 * The public tournament flow. It deliberately reads the same projection as
 * Control Room but exposes no operation or editing surface.
 */
export default function OverviewPage() {
  const { tournamentId, divisions } = useTournamentPageContext();
  const room = useControlRoom(tournamentId);
  const visibleFlows = room.flows.filter((flow) => !flow.archivedAt);

  if (room.query.isLoading) return <p className="py-12 text-center text-sm text-ui-text-mute">Loading tournament timeline…</p>;
  if (room.query.isError) return <p className="py-12 text-center text-sm text-state-failed">Unable to load the tournament timeline.</p>;

  return (
    <TournamentTimelineOverview flows={visibleFlows} divisions={divisions} />
  );
}
