import { Song } from "@/features/song/types/Song";
import Select from "react-select";
import { selectPortalStyles } from "@/styles/selectStyles";
import MultiSelect, { MultiSelectOption } from "@/shared/components/ui/MultiSelect";

type AddEditSongTitleFieldsProps = {
  songGroups: string[];
  selectedGroupName: string;
  selectedSongs: Song[];
  filteredSongs: Song[];
  onGroupChange: (group: string) => void;
  onSongsSelect: (songs: Song[]) => void;
};

export default function AddEditSongTitleFields({
  songGroups,
  selectedGroupName,
  selectedSongs,
  filteredSongs,
  onGroupChange,
  onSongsSelect,
}: AddEditSongTitleFieldsProps) {
  const songOptions = filteredSongs.map((song) => ({
    value: song.id,
    label: song.artist ? `${song.artist} - ${song.title}` : song.title,
  }));

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="mb-2">Select pack</h3>
        <Select
          options={songGroups.map((group) => ({ value: group, label: group }))}
          placeholder="Select pack..."
          value={selectedGroupName ? { value: selectedGroupName, label: selectedGroupName } : null}
          onChange={(selected) => onGroupChange(selected?.value ?? "")}
          menuPortalTarget={document.body}
          styles={selectPortalStyles}
        />
      </div>

      <div>
        <h3 className="mb-2">Select songs</h3>
        {filteredSongs.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-4 text-sm text-gray-400 italic">
            No songs match the current filters.
          </div>
        ) : (
          <MultiSelect
            options={songOptions}
            value={selectedSongs.map((song) => ({
              value: song.id,
              label: song.artist ? `${song.artist} - ${song.title}` : song.title,
            }))}
            onChange={(selected) =>
              onSongsSelect(
                selected
                  .map((option: MultiSelectOption) => filteredSongs.find((song) => song.id === option.value))
                  .filter((song): song is Song => Boolean(song)),
              )
            }
            placeholder="Select songs..."
          />
        )}
      </div>
    </div>
  );
}
