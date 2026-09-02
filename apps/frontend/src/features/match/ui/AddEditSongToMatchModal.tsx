import FormModal from "@/shared/components/ui/FormModal";
import SongRollPanel from "@/features/song/ui/SongRollPanel";
import AddEditSongTitleFields from "@/features/match/ui/AddEditSongTitleFields";
import { useAddEditSongToMatchModal } from "@/features/match/model/useAddEditSongToMatchModal";
import { RoundSourceRequest } from "@/features/match/model/types";

/**
 * Picks the song for a round: a title, several titles, or a draw over the pool
 * the division may still play. Editing replaces the song of one round, which is
 * why it names a round and not a song — and why a draw made to replace one is
 * confirmed only while it holds a single card.
 */
type AddSongToMatchModalProps = {
  tournamentId?: number;
  /** The pool a draw reaches, and the match whose songs it may never repeat. */
  divisionId?: number;
  matchId?: number;
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
    divisionId: props.divisionId,
    matchId: props.matchId,
  });

  const validate = () => {
    if (state.songAddType === "roll") {
      /* A draw is confirmed by what is on the table, not by what was asked
         for: rolling is a separate act, and nothing is added before it. */
      if (state.roll.drawnSongIds.length === 0) {
        return ["Roll the songs before adding them."];
      }

      return props.editingRoundId !== null && state.roll.drawnSongIds.length > 1
        ? ["Replacing a song takes one card: take the others out of the draw."]
        : [];
    }

    return state.selectedSongs.length === 0 ? ["Choose at least one song."] : [];
  };

  const handleSubmit = async () => {
    /* Both kinds of choice commit song ids: the draw sends the cards it kept,
       which is what makes the dialog answer with the songs it showed. */
    const sources: RoundSourceRequest[] =
      state.songAddType === "roll"
        ? state.roll.drawnSongIds.map((songId) => ({ songId }))
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
          <SongRollPanel roll={state.roll} songGroups={state.songGroups} />
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
