import TournamentLiveLobbies from "@/features/live/ui/TournamentLiveLobbies";
import { useTournamentPageContext } from "@/features/tournament/model/TournamentPageContext";

export default function LivePage() {
  const { tournamentId, controls } = useTournamentPageContext();
  return <TournamentLiveLobbies tournamentId={tournamentId} controls={controls} />;
}
