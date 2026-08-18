import SongsToolbar from "@/features/song/components/SongsToolbar";
import { useSongsList } from "@/features/song/hooks/useSongsList";
import SongListView from "./SongListView";

type SongsListProps = {
  canEdit?: boolean;
  tournamentId?: number;
  songsVersion?: number;
};

export default function SongsList({
  canEdit = true,
  tournamentId,
  songsVersion = 0,
}: SongsListProps) {
  const {
    songs,
    packFilter,
    songSearch,
    packOptions,
    setPackFilter,
    setSongSearch,
    handleDeleteSong,
    handleDeletePack,
  } = useSongsList({ tournamentId, songsVersion });

  return (
    <div className="flex flex-col gap-4 w-full max-w-5xl mx-auto">
      <SongsToolbar
        packFilter={packFilter}
        songSearch={songSearch}
        packOptions={packOptions}
        onPackFilterChange={setPackFilter}
        onSongSearchChange={setSongSearch}
      />
      <SongListView
        songs={songs}
        packFilter={packFilter}
        songSearch={songSearch}
        canEdit={canEdit}
        onDelete={handleDeleteSong}
        onDeletePack={handleDeletePack}
      />
    </div>
  );
}
