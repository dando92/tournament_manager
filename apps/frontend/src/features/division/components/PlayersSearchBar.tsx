import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch } from "@fortawesome/free-solid-svg-icons";

type PlayersSearchBarProps = {
  value: string;
  onChange: (value: string) => void;
};

export default function PlayersSearchBar({ value, onChange }: PlayersSearchBarProps) {
  return (
    <div className="relative">
      <FontAwesomeIcon
        icon={faSearch}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"
      />
      <input
        type="search"
        placeholder="Search by name..."
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-dark/30"
      />
    </div>
  );
}
