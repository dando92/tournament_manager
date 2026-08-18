import Select from "react-select";
import { selectPortalStyles } from "@/styles/selectStyles";

type AddEditSongRollFieldsProps = {
  songGroups: string[];
  selectedGroupName: string;
  difficultyInput: string;
  onGroupChange: (group: string) => void;
  onDifficultyChange: (value: string) => void;
};

export default function AddEditSongRollFields({
  songGroups,
  selectedGroupName,
  difficultyInput,
  onGroupChange,
  onDifficultyChange,
}: AddEditSongRollFieldsProps) {
  return (
    <div>
      <div className="w-full py-2">
        <h3>Select song pack to roll</h3>
        <Select
          options={songGroups.map((group) => ({ value: group, label: group }))}
          placeholder="Select group..."
          className="w-[300px]"
          value={selectedGroupName ? { value: selectedGroupName, label: selectedGroupName } : null}
          onChange={(selected) => onGroupChange(selected?.value ?? "")}
          menuPortalTarget={document.body}
          styles={selectPortalStyles}
        />
      </div>

      <h3 className="mt-2">Type song difficulty to roll</h3>
      <div>
        <input
          value={difficultyInput}
          onChange={(event) => onDifficultyChange(event.target.value)}
          className="border border-gray-300 px-2 py-2 mr-2 rounded-lg"
          type="number"
          placeholder="Type difficulty"
        />
      </div>
    </div>
  );
}
