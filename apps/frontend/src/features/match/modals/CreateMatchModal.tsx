import OkModal from "@/shared/components/ui/OkModal";
import Select from "react-select";
import { selectPortalStyles } from "@/styles/selectStyles";
import { CreateMatchRequest } from "@/features/match/types/match-requests";
import CreateMatchScopeFields from "@/features/match/components/CreateMatchScopeFields";
import CreateMatchSongFields from "@/features/match/components/CreateMatchSongFields";
import { useCreateMatchModal } from "@/features/match/hooks/useCreateMatchModal";
import { MatchPhaseOption } from "@/features/match/types/MatchPhaseOption";
import { TournamentDivisionOption } from "@/features/tournament/types/TournamentDivisionOption";
import MultiSelect from "@/shared/components/ui/MultiSelect";

type CreateMatchModalProps = {
  open: boolean;
  onClose: () => void;
  onCreate: (request: CreateMatchRequest) => void;
  phaseId?: number;
  phaseGroupId?: number;
  phases?: MatchPhaseOption[];
  divisionId?: number;
  divisions?: TournamentDivisionOption[];
  tournamentId?: number;
};

export default function CreateMatchModal(props: CreateMatchModalProps) {
  const state = useCreateMatchModal(props);

  return (
    <OkModal
      okText="Create match"
      title="Create Match"
      open={props.open}
      onClose={props.onClose}
      onOk={state.handleSubmit}
    >
      <div className="flex flex-col w-full gap-3">
        <CreateMatchScopeFields
          divisionId={props.divisionId}
          phaseId={props.phaseId}
          phaseGroupId={props.phaseGroupId}
          divisions={props.divisions}
          phases={props.phases}
          availablePhases={state.availablePhases}
          availablePhaseGroups={state.availablePhaseGroups}
          selectedDivisionId={state.selectedDivisionId}
          selectedPhaseId={state.selectedPhaseId}
          selectedPhaseGroupId={state.selectedPhaseGroupId}
          onDivisionChange={state.setSelectedDivisionId}
          onPhaseChange={state.setSelectedPhaseId}
          onPhaseGroupChange={state.setSelectedPhaseGroupId}
        />

        <div className="w-full">
          <h3>Name</h3>
          <input
            className="w-full border border-gray-300 px-2 py-2 rounded-lg"
            type="text"
            value={state.name}
            onChange={(event) => state.setName(event.target.value)}
            placeholder="Type match name"
          />
        </div>
        <div className="w-full">
          <h3>Subtitle</h3>
          <input
            className="w-full border border-gray-300 px-2 py-2 rounded-lg"
            type="text"
            value={state.subtitle}
            onChange={(event) => state.setSubtitle(event.target.value)}
            placeholder="Type subtitle"
          />
        </div>
        <div>
          <h3>Scoring system</h3>
          <Select
            options={state.scoringSystems.map((system) => ({ value: system, label: system }))}
            placeholder="Select scoring system..."
            value={state.scoringSystem ? { value: state.scoringSystem, label: state.scoringSystem } : null}
            onChange={(selected) => state.setScoringSystem(selected?.value ?? "")}
            menuPortalTarget={document.body}
            styles={selectPortalStyles}
          />
        </div>
        <div className="w-full">
          <h3>Entrants</h3>
          <MultiSelect
            options={state.entrants.map((entrant) => ({ value: entrant.id, label: entrant.name }))}
            onChange={(selected) =>
              state.setSelectedEntrants(
                selected
                  .map((option) => state.entrants.find((entrant) => entrant.id === option.value))
                  .filter((entrant): entrant is (typeof state.entrants)[number] => Boolean(entrant)),
              )
            }
            value={state.selectedEntrants.map((entrant) => ({ value: entrant.id, label: entrant.name }))}
          />
        </div>

        <CreateMatchSongFields
          songAddType={state.songAddType}
          songs={state.songs}
          songGroups={state.songGroups}
          selectedSongs={state.selectedSongs}
          selectedSongDifficulties={state.selectedSongDifficulties}
          selectedGroupName={state.selectedGroupName}
          difficultyInput={state.difficultyInput}
          onSongAddTypeChange={state.setSongAddType}
          onSelectedSongsChange={state.setSelectedSongs}
          onSelectedGroupNameChange={state.setSelectedGroupName}
          onDifficultyInputChange={state.setDifficultyInput}
          onAddDifficulty={state.addDifficulty}
          onRemoveDifficulty={state.removeDifficulty}
        />
      </div>
    </OkModal>
  );
}
