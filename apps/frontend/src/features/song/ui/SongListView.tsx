import { useMemo } from "react";
import { Song } from "@/features/song/model/types";
import DeleteConfirmButton from "@/shared/components/ui/DeleteConfirmButton";
import SongRow from "./SongRow";

type Props = {
  songs: Song[];
  packFilter: string;
  songSearch: string;
  canEdit: boolean;
  onDelete: (id: number) => void;
  onDeletePack: (pack: string) => void;
};

export default function SongListView({ songs, packFilter, songSearch, canEdit, onDelete, onDeletePack }: Props) {
  const filtered = useMemo(() => {
    const q = songSearch.toLowerCase();
    return songs
      .filter((s) => {
        const matchesPack = !packFilter || s.group === packFilter;
        const matchesSong =
          !q ||
          s.title.toLowerCase().includes(q) ||
          (s.artist ?? "").toLowerCase().includes(q);
        return matchesPack && matchesSong;
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [songs, packFilter, songSearch]);

  const grouped = useMemo(() => {
    const map = new Map<string, Song[]>();
    for (const song of filtered) {
      const list = map.get(song.group) ?? [];
      list.push(song);
      map.set(song.group, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  if (filtered.length === 0) {
    return (
      <div className="text-center py-12 text-ui-text-mute text-sm italic">
        No songs match your search.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {grouped.map(([pack, packSongs]) => (
        <div key={pack} className="rounded-lg border border-ui-border shadow-sm overflow-hidden bg-ui-surface">
          <div className="flex items-center gap-2 border-b border-ui-border bg-ui-raised px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-ui-text-mute">
            <span className="flex-1 truncate">{pack}</span>
            <span className="font-normal opacity-70 shrink-0">
              {packSongs.length} song{packSongs.length !== 1 ? "s" : ""}
            </span>
            {canEdit && (
              <DeleteConfirmButton
                onConfirm={() => onDeletePack(pack)}
                className="shrink-0 ml-1"
                iconClassName="w-3"
                title={`Delete pack "${pack}"`}
                confirmMessage={`Delete pack "${pack}" and all its songs?`}
              />
            )}
          </div>

          {packSongs.map((song) => (
            <SongRow
              key={song.id}
              song={song}
              canEdit={canEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
