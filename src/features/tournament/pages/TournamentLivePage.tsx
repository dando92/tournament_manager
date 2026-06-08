import TournamentLiveLobbies from "@/features/live/components/TournamentLiveLobbies";
import { useTournamentPageContext } from "@/features/tournament/context/TournamentPageContext";

export default function TournamentLivePage() {
  const { tournamentId, controls } = useTournamentPageContext();
  return <TournamentLiveLobbies tournamentId={tournamentId} controls={controls} />;
}
