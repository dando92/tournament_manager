import LobbyLiveBlock from "@/features/live/ui/LobbyLiveBlock";
import { useLivePhase } from "@/features/live/model/useLivePhase";
import StatusIcon from "@/shared/components/ui/StatusIcon";

/**
 * What is being played right now, under the match you have open.
 *
 * It lists the tournament's live lobbies rather than the one running the
 * selected match: the live protocol reports per lobby and carries no match id,
 * so binding a lobby to a match is not something the data supports yet.
 *
 * The panel disappears entirely when nothing is live. An empty "no live
 * lobbies" block under every match would be a permanent reminder of nothing.
 */
export default function LiveNowPanel({ tournamentId, controls }: { tournamentId: number; controls: boolean }) {
  const { tournamentLiveStates } = useLivePhase(tournamentId);

  if (tournamentLiveStates.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-ui-text-mute">
        <StatusIcon status="running" className="h-3 w-3" />
        Live now
      </h2>
      <div className="grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2">
        {tournamentLiveStates.map((lobbyState) => (
          <LobbyLiveBlock key={lobbyState.lobbyId} lobbyState={lobbyState} showObsSource={controls} />
        ))}
      </div>
    </section>
  );
}
