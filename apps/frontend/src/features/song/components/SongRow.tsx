import { Song } from "@/features/song/types/Song";
import DeleteConfirmButton from "@/shared/components/ui/DeleteConfirmButton";

function difficultyColor(difficulty: number): string {
  if (difficulty <= 3) return "bg-green-500";
  if (difficulty <= 6) return "bg-yellow-500";
  if (difficulty <= 9) return "bg-orange-500";
  if (difficulty <= 12) return "bg-red-600";
  return "bg-purple-700";
}

type Props = {
  song: Song;
  canEdit: boolean;
  onDelete: (id: number) => void;
};

export default function SongRow({ song, canEdit, onDelete }: Props) {
  const label = song.artist ? `${song.artist} - ${song.title}` : song.title;

  return (
    <div className="border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors">
        <span
          className={`${difficultyColor(song.difficulty)} text-white text-xs font-bold w-7 h-7 flex items-center justify-center rounded shrink-0`}
        >
          {song.difficulty}
        </span>

        <span className="flex-1 text-sm text-gray-800 truncate">{label}</span>

        {canEdit && (
          <DeleteConfirmButton
            onConfirm={() => onDelete(song.id)}
            className="text-sm shrink-0"
            title="Delete song"
            confirmMessage={`Delete "${label}"?`}
          />
        )}
      </div>
    </div>
  );
}
