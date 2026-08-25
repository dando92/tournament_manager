import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowDownAZ, faDownload, faSpinner } from "@fortawesome/free-solid-svg-icons";
import PlayersByNameList from "@/features/division/ui/PlayersByNameList";
import PlayersSearchBar from "@/features/division/ui/PlayersSearchBar";
import PlayersWarning from "@/features/division/ui/PlayersWarning";
import { usePlayersTab } from "@/features/division/model/usePlayersTab";
import { useItgmaniaProfileExport } from "@/features/participant/model/useItgmaniaProfileExport";
import { Division } from "@/features/division/model/types";
import { Entrant } from "@/features/participant/model/types";
import { btnSecondary } from "@/styles/buttonStyles";

type Props = {
  division: Division;
  entrants: Entrant[];
  canEdit: boolean;
  tournamentName: string;
  divisionIds: number[];
};

export default function PlayersTab({ division, entrants, canEdit, tournamentName, divisionIds }: Props) {
  const [orderByName, setOrderByName] = useState(false);
  const state = usePlayersTab({ division, entrants, orderByName });
  const profileExport = useItgmaniaProfileExport({ tournamentName, divisionIds });

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <PlayersSearchBar value={state.search} onChange={state.setSearch} />
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={profileExport.exportProfiles}
            disabled={profileExport.exporting}
            className={`flex shrink-0 items-center gap-2 text-xs font-medium ${btnSecondary}`}
            title="Export ITGmania profiles"
          >
            <FontAwesomeIcon icon={profileExport.exporting ? faSpinner : faDownload} className={profileExport.exporting ? "animate-spin" : undefined} />
            {profileExport.exporting ? "Exporting..." : "Export ITGmania"}
          </button>
        )}
        <button
          type="button"
          onClick={() => setOrderByName((current) => !current)}
          className={`flex shrink-0 items-center gap-2 rounded border px-3 py-2 text-xs font-medium transition-colors ${
            orderByName
              ? "border-ui-border-strong bg-ui-selected text-ui-text"
              : "border-ui-border text-ui-text-soft hover:border-ui-border-strong hover:bg-ui-raised"
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
