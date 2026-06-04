import { Division } from "@/features/division/types/Division";
import PlayersByNameList from "@/features/division/components/PlayersByNameList";
import PlayersSearchBar from "@/features/division/components/PlayersSearchBar";
import PlayersTabHeader from "@/features/division/components/PlayersTabHeader";
import PlayersWarning from "@/features/division/components/PlayersWarning";
import { usePlayersTab } from "@/features/division/hooks/usePlayersTab";
import SelectParticipantsModal from "./SelectParticipantsModal";

type Props = {
  division: Division;
  canEdit: boolean;
  onPlayersChanged: () => void;
};

export default function PlayersTab({ division, canEdit, onPlayersChanged }: Props) {
  const state = usePlayersTab({ division, onPlayersChanged });

  return (
    <div className="flex flex-col gap-4 max-w-3xl mx-auto">
      <SelectParticipantsModal
        open={state.showSelectModal}
        participants={state.filteredAvailableParticipants}
        onAdd={state.handleAdd}
        onClose={() => state.setShowSelectModal(false)}
      />

      <PlayersTabHeader
        canEdit={canEdit}
        onSelectParticipants={() => state.setShowSelectModal(true)}
      />

      <PlayersSearchBar value={state.search} onChange={state.setSearch} />
      <PlayersWarning warnings={[]} />

      <PlayersByNameList
        players={state.filteredAllAlpha}
        canEdit={canEdit}
        divisionParticipantIds={state.divisionParticipantIds}
        onRemove={state.handleRemove}
        totalParticipants={state.filteredAllAlpha.length}
      />
    </div>
  );
}
