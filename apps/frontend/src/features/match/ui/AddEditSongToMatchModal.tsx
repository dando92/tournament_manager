import OkModal from "@/shared/components/ui/OkModal";
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
  divisionId: number;
  tournamentId?: number;
  /** The round whose song is being replaced, or null when adding new rounds. */
  editingRoundId: number | null;
  open: boolean;
  onClose: () => void;
  onAddRounds: (sources: RoundSourceRequest[]) => void;
  onReplaceRoundSong: (roundId: number, source: RoundSourceRequest) => void;
};

export default function AddEditSongToMatchModal(props: AddSongToMatchModalProps) {
  const state = useAddEditSongToMatchModal({
    open: props.open,
    tournamentId: props.tournamentId,
  });

  const handleSubmit = () => {
    if (state.songAddType === "roll") {
      if (!state.selectedGroupName || !state.difficultyInput) return;
      const source: RoundSourceRequest = {
        divisionId: props.divisionId,
        group: state.selectedGroupName,
        level: state.difficultyInput,
      };

      if (props.editingRoundId !== null) props.onReplaceRoundSong(props.editingRoundId, source);
      else props.onAddRounds([source]);

      props.onClose();
      return;
    }

    if (state.selectedSongs.length === 0) return;

    if (props.editingRoundId !== null) {
      props.onReplaceRoundSong(props.editingRoundId, { songId: state.selectedSongs[0].id });
    } else {
      props.onAddRounds(state.selectedSongs.map((song) => ({ songId: song.id })));
    }

    props.onClose();
  };

  return (
    <OkModal
      open={props.open}
      onClose={props.onClose}
      title={props.editingRoundId !== null ? "Edit song" : "Add song"}
      onOk={handleSubmit}
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
    </OkModal>
  );
}
