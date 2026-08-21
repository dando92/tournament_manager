import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowDownAZ } from "@fortawesome/free-solid-svg-icons";
import PlayersByNameList from "@/features/division/components/PlayersByNameList";
import PlayersSearchBar from "@/features/division/components/PlayersSearchBar";
import PlayersWarning from "@/features/division/components/PlayersWarning";
import { usePlayersTab } from "@/features/division/hooks/usePlayersTab";
import { Division } from "@/features/division/types/Division";

type Props = {
  division: Division;
  canEdit: boolean;
  onPlayersChanged: () => void;
};

export default function PlayersTab({ division, canEdit, onPlayersChanged }: Props) {
  const [orderByName, setOrderByName] = useState(false);
  const state = usePlayersTab({ division, orderByName, onPlayersChanged });

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <PlayersSearchBar value={state.search} onChange={state.setSearch} />
        </div>
        <button
          type="button"
          onClick={() => setOrderByName((current) => !current)}
          className={`flex shrink-0 items-center gap-2 rounded border px-3 py-2 text-xs font-medium transition-colors ${
            orderByName
              ? "border-brand-700 bg-brand-50 text-brand-700"
              : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
          }`}
          title={orderByName ? "Use default order" : "Order by name"}
        >
          <FontAwesomeIcon icon={faArrowDownAZ} />
          {orderByName ? "Name order" : "Default order"}
        </button>
      </div>
      <PlayersWarning warnings={[]} />

      <PlayersByNameList
        players={state.filteredAllParticipants}
        canEdit={canEdit}
        divisionParticipantIds={state.divisionParticipantIds}
        onAdd={state.handleAdd}
        onRemove={state.handleRemove}
        totalParticipants={state.filteredAllParticipants.length}
      />
    </div>
  );
}
