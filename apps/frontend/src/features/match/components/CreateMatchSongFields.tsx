import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMinusCircle, faPlusCircle } from "@fortawesome/free-solid-svg-icons";
import Select from "react-select";
import { Song } from "@/features/song/types/Song";
import { selectPortalStyles } from "@/styles/selectStyles";
import MultiSelect, { MultiSelectOption } from "@/shared/components/ui/MultiSelect";

type CreateMatchSongFieldsProps = {
  songAddType: "title" | "roll";
  songs: Song[];
  songGroups: string[];
  selectedSongs: Song[];
  selectedSongDifficulties: string[];
  selectedGroupName: string;
  difficultyInput: string;
  onSongAddTypeChange: (value: "title" | "roll") => void;
  onSelectedSongsChange: (songs: Song[]) => void;
  onSelectedGroupNameChange: (group: string) => void;
  onDifficultyInputChange: (value: string) => void;
  onAddDifficulty: () => void;
  onRemoveDifficulty: (index: number) => void;
};

export default function CreateMatchSongFields({
  songAddType,
  songs,
  songGroups,
  selectedSongs,
  selectedSongDifficulties,
  selectedGroupName,
  difficultyInput,
  onSongAddTypeChange,
  onSelectedSongsChange,
  onSelectedGroupNameChange,
  onDifficultyInputChange,
  onAddDifficulty,
  onRemoveDifficulty,
}: CreateMatchSongFieldsProps) {
  const songOptions = songs.map((song) => ({ value: song.id, label: song.title }));

  return (
    <div className="w-full">
      <h3>Songs</h3>
      <div className="flex flex-row gap-3 mb-2">
        <div className="flex flex-row gap-1">
          <input
            type="radio"
            id="title"
            name="songAddType"
            value="title"
            checked={songAddType === "title"}
            onChange={() => onSongAddTypeChange("title")}
          />
          <label htmlFor="title">By titles</label>
        </div>
        <div className="flex flex-row gap-1">
          <input
            type="radio"
            id="roll"
            name="songAddType"
            value="roll"
            checked={songAddType === "roll"}
            onChange={() => onSongAddTypeChange("roll")}
          />
          <label htmlFor="roll">By roll</label>
        </div>
      </div>

      {songAddType === "roll" && (
        <div>
          <div className="w-full py-2">
            <h3>Select song pack to roll</h3>
            <Select
              options={songGroups.map((group) => ({ value: group, label: group }))}
              placeholder="Select group..."
              className="w-[300px]"
              value={selectedGroupName ? { value: selectedGroupName, label: selectedGroupName } : null}
              onChange={(selected) => onSelectedGroupNameChange(selected?.value ?? "")}
              menuPortalTarget={document.body}
              styles={selectPortalStyles}
            />
          </div>

          <h3 className="mt-2">Type song difficulties to roll</h3>
          {selectedSongDifficulties.length > 0 && (
            <div className="flex my-2 flex-col gap-2 w-96">
              {selectedSongDifficulties.map((difficulty, index) => (
                <div key={`${difficulty}-${index}`} className="flex flex-row items-center gap-2">
                  <span className="w-6 font-bold">{difficulty}</span>
                  <button onClick={() => onRemoveDifficulty(index)} className="text-red-700 text-sm">
                    <FontAwesomeIcon icon={faMinusCircle} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div>
            <input
              value={difficultyInput}
              onChange={(event) => onDifficultyInputChange(event.target.value)}
              className="border border-gray-300 px-2 py-2 mr-2 rounded-lg"
              type="number"
              placeholder="Type difficulty"
            />
            <button onClick={onAddDifficulty} className="text-green-700 text-lg">
              <FontAwesomeIcon icon={faPlusCircle} />
            </button>
          </div>
        </div>
      )}

      {songAddType === "title" && (
        <MultiSelect
          options={songOptions}
          value={selectedSongs.map((song) => ({ value: song.id, label: song.title }))}
          onChange={(selected) =>
            onSelectedSongsChange(
              selected
                .map((option: MultiSelectOption) => songs.find((song) => song.id === option.value))
                .filter((song): song is Song => Boolean(song)),
            )
          }
        />
      )}
    </div>
  );
}
