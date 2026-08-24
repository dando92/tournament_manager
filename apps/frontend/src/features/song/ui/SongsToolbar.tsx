import { faSearch } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

type Props = {
  packFilter: string;
  songSearch: string;
  packOptions: string[];
  onPackFilterChange: (value: string) => void;
  onSongSearchChange: (value: string) => void;
};

export default function SongsToolbar({
  packFilter,
  songSearch,
  packOptions,
  onPackFilterChange,
  onSongSearchChange,
}: Props) {
  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <div className="relative sm:w-48 shrink-0">
        <select
          value={packFilter}
          onChange={(event) => onPackFilterChange(event.target.value)}
          className="w-full border border-ui-border-strong rounded-lg px-3 py-2 text-sm bg-ui-surface appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-ui-accent"
        >
          <option value="">All packs</option>
          {packOptions.map((group) => (
            <option key={group} value={group}>
              {group}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ui-text-mute text-xs">▼</span>
      </div>

      <div className="relative flex-1">
        <FontAwesomeIcon
          icon={faSearch}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-ui-text-mute text-sm"
        />
        <input
          type="search"
          placeholder="Search by title or artist..."
          value={songSearch}
          onChange={(event) => onSongSearchChange(event.target.value)}
          className="w-full border border-ui-border-strong rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ui-accent"
        />
      </div>
    </div>
  );
}
