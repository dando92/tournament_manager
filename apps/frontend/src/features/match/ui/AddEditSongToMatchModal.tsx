import FormModal from "@/shared/components/ui/FormModal";
import AddEditSongRollFields from "@/features/match/ui/AddEditSongRollFields";
import AddEditSongTitleFields from "@/features/match/ui/AddEditSongTitleFields";
import { useAddEditSongToMatchModal } from "@/features/match/model/useAddEditSongToMatchModal";
import { RoundSourceRequest } from "@/features/match/model/types";

/**
 * Picks the song for a round: a title, several titles, or a roll over a group
 * and a difficulty. Editing replaces the song of one round, which is why it
 * names a round and not a song.
 */
type AddSongToMatchModalProps = {
  tournamentId?: number;
  /** The round whose song is being replaced, or null when adding new rounds. */
  editingRoundId: number | null;
  open: boolean;
  onClose: () => void;
  onAddRounds: (sources: RoundSourceRequest[]) => Promise<void>;
  onReplaceRoundSong: (roundId: number, source: RoundSourceRequest) => Promise<void>;
};

export default function AddEditSongToMatchModal(props: AddSongToMatchModalProps) {
  const state = useAddEditSongToMatchModal({
    open: props.open,
    tournamentId: props.tournamentId,
  });

  const validate = () => {
    if (state.songAddType === "roll") {
      const errors: string[] = [];
      if (!state.selectedGroupName) {
        errors.push("Choose the pack to roll from.");
      }
      if (!state.difficultyInput) {
        errors.push("Choose the difficulty to roll.");
      }

      return errors;
    }

    return state.selectedSongs.length === 0 ? ["Choose at least one song."] : [];
  };

  const handleSubmit = async () => {
    const sources: RoundSourceRequest[] =
      state.songAddType === "roll"
        ? [{ group: state.selectedGroupName, level: state.difficultyInput }]
        : state.selectedSongs.map((song) => ({ songId: song.id }));

    /* Editing replaces the song of one round, so only the first choice lands. */
    if (props.editingRoundId !== null) {
      await props.onReplaceRoundSong(props.editingRoundId, sources[0]);
      return;
    }

    await props.onAddRounds(sources);
  };

  return (
    <FormModal
      open={props.open}
      onClose={props.onClose}
      title={props.editingRoundId !== null ? "Edit song" : "Add song"}
      confirmText={props.editingRoundId !== null ? "Replace song" : "Add song"}
      validate={validate}
      onConfirm={handleSubmit}
      failureFallback="The song could not be set on the match."
    >
      <div className="w-full">
        <h3>Songs</h3>
        <div className="flex flex-row gap-3 mb-2">
          <div className="flex flex-row gap-1">
            <input
              type="radio"
              id="title"
              name="songAddType"
              value="title"
              checked={state.songAddType === "title"}
              onChange={() => state.setSongAddType("title")}
            />
            <label htmlFor="title">By title</label>
          </div>
          <div className="flex flex-row gap-1">
            <input
              type="radio"
              id="roll"
              name="songAddType"
              value="roll"
              checked={state.songAddType === "roll"}
              onChange={() => state.setSongAddType("roll")}
            />
            <label htmlFor="roll">By roll</label>
          </div>
        </div>

        {state.songAddType === "roll" ? (
          <AddEditSongRollFields
            songGroups={state.songGroups}
            selectedGroupName={state.selectedGroupName}
            difficultyInput={state.difficultyInput}
            onGroupChange={state.setSelectedGroupName}
            onDifficultyChange={state.setDifficultyInput}
          />
        ) : (
          <AddEditSongTitleFields
            songGroups={state.songGroups}
            selectedGroupName={state.selectedGroupName}
            selectedSongs={state.selectedSongs}
            filteredSongs={state.filteredSongs}
            onGroupChange={state.setSelectedGroupName}
            onSongsSelect={state.setSelectedSongs}
          />
        )}
      </div>
    </FormModal>
  );
}
