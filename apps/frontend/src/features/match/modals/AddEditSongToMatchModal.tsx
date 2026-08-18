import OkModal from "@/shared/components/ui/OkModal";
import AddEditSongRollFields from "@/features/match/components/AddEditSongRollFields";
import AddEditSongTitleFields from "@/features/match/components/AddEditSongTitleFields";
import { useAddEditSongToMatchModal } from "@/features/match/hooks/useAddEditSongToMatchModal";

type AddSongToMatchModalProps = {
  divisionId: number;
  matchId: number;
  songId?: number | null;
  tournamentId?: number;
  open: boolean;
  onClose: () => void;
  onAddSongToMatchByRoll: (
    divisionId: number,
    matchId: number,
    group: string,
    level: string,
  ) => void;
  onAddSongToMatchBySongId: (
    divisionId: number,
    matchId: number,
    songId: number,
  ) => void;
  onEditSongToMatchByRoll: (
    divisionId: number,
    matchId: number,
    group: string,
    level: string,
    editSongId: number,
  ) => void;
  onEditSongToMatchBySongId: (
    divisionId: number,
    matchId: number,
    songId: number,
    editSongId: number,
  ) => void;
};

export default function AddEditSongToMatchModal(props: AddSongToMatchModalProps) {
  const state = useAddEditSongToMatchModal({
    open: props.open,
    tournamentId: props.tournamentId,
  });

  const handleSubmit = () => {
    if (state.songAddType === "roll") {
      if (state.selectedGroupName && state.difficultyInput) {
        if (props.songId) {
          props.onEditSongToMatchByRoll(
            props.divisionId,
            props.matchId,
            state.selectedGroupName,
            state.difficultyInput,
            props.songId,
          );
        } else {
          props.onAddSongToMatchByRoll(
            props.divisionId,
            props.matchId,
            state.selectedGroupName,
            state.difficultyInput,
          );
        }
        props.onClose();
      }
      return;
    }

    if (state.selectedSongs.length > 0) {
      if (props.songId) {
        const selectedSong = state.selectedSongs[0];
        props.onEditSongToMatchBySongId(
          props.divisionId,
          props.matchId,
          selectedSong.id,
          props.songId,
        );
      } else {
        state.selectedSongs.forEach((song) =>
          props.onAddSongToMatchBySongId(props.divisionId, props.matchId, song.id),
        );
      }
      props.onClose();
    }
  };

  return (
    <OkModal
      open={props.open}
      onClose={props.onClose}
      title={props.songId ? "Edit song" : "Add song"}
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
