import SongsList from "@/features/song/components/SongsList";
import { useTournamentPageContext } from "@/features/tournament/model/TournamentPageContext";

export default function SongsPage() {
  const { controls, tournamentId, songsVersion } = useTournamentPageContext();
  return <SongsList canEdit={controls} tournamentId={tournamentId} songsVersion={songsVersion} />;
}
