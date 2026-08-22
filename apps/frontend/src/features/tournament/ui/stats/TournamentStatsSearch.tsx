import { faSearch } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
};

export default function TournamentStatsSearch({
  search,
  onSearchChange,
}: Props) {
  return (
    <div className="relative">
      <FontAwesomeIcon
        icon={faSearch}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-ui-text-mute text-sm"
      />
      <input
        type="search"
        placeholder="Search player name..."
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        className="w-full border border-ui-border-strong rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-state-running"
      />
    </div>
  );
}
