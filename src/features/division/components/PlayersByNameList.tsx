import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMinus } from "@fortawesome/free-solid-svg-icons";
import { Participant } from "@/features/entrant/types/Entrant";

type PlayersByNameListProps = {
  players: Participant[];
  canEdit: boolean;
  divisionParticipantIds: Set<number>;
  onRemove: (participantId: number) => void;
  totalParticipants: number;
};

export default function PlayersByNameList({
  players,
  canEdit,
  divisionParticipantIds,
  onRemove,
  totalParticipants,
}: PlayersByNameListProps) {
  if (players.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic">
        {totalParticipants === 0 ? "No participants available." : "No participants match your search."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {players.map((participant) => {
        const inDivision = divisionParticipantIds.has(participant.id);

        return (
          <div
            key={participant.id}
            className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded text-sm"
          >
            <div className="flex items-center gap-2">
              <span className={inDivision ? "" : "text-gray-400"}>{participant.player.playerName}</span>
            </div>
            {canEdit && inDivision && (
                <button
                  onClick={() => onRemove(participant.id)}
                  className="text-red-500 hover:text-red-700 ml-2"
                  title="Remove entrant"
                >
                  <FontAwesomeIcon icon={faMinus} />
                </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
