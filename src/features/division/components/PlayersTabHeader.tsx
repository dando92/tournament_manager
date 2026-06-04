import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUsers } from "@fortawesome/free-solid-svg-icons";
import { btnPrimary } from "@/styles/buttonStyles";

type PlayersTabHeaderProps = {
  canEdit: boolean;
  onSelectParticipants: () => void;
};

export default function PlayersTabHeader({
  canEdit,
  onSelectParticipants,
}: PlayersTabHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <h2 className="text-primary-dark font-bold text-xl">Entrants</h2>
      <div className="flex items-center gap-2 flex-wrap">
        {canEdit && (
          <button
            onClick={onSelectParticipants}
            className={`${btnPrimary} flex items-center gap-1.5 text-sm`}
          >
            <FontAwesomeIcon icon={faUsers} />
            <span className="hidden sm:inline">Select participants</span>
          </button>
        )}
      </div>
    </div>
  );
}
