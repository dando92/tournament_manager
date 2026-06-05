import { Participant } from "@/features/entrant/types/Entrant";
import EntrantMembershipRow from "@/features/division/components/EntrantMembershipRow";

type PlayersByNameListProps = {
  players: Participant[];
  canEdit: boolean;
  divisionParticipantIds: Set<number>;
  onAdd: (participant: Participant) => void;
  onRemove: (participantId: number) => void;
  totalParticipants: number;
};

export default function PlayersByNameList({
  players,
  canEdit,
  divisionParticipantIds,
  onAdd,
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
          <EntrantMembershipRow
            key={participant.id}
            name={participant.player.playerName}
            present={inDivision}
            canEdit={canEdit}
            onAdd={() => onAdd(participant)}
            onRemove={() => onRemove(participant.id)}
          />
        );
      })}
    </div>
  );
}
