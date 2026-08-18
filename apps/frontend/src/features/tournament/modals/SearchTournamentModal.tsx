import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import BaseModal from "@/shared/components/ui/BaseModal";
import { Tournament } from "@/features/tournament/types/Tournament";
import { addRecentTournament } from "@/features/tournament/services/recentTournaments";

type Props = {
  open: boolean;
  onClose: () => void;
};

const BANNER_COLORS = [
  "from-red-700 to-red-900",
  "from-blue-700 to-blue-900",
  "from-purple-700 to-purple-900",
  "from-emerald-700 to-emerald-900",
  "from-orange-600 to-red-800",
  "from-cyan-700 to-blue-900",
];

function getBannerColor(id: number) {
  return BANNER_COLORS[id % BANNER_COLORS.length];
}

export default function SearchTournamentModal({ open, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      axios
        .get<Tournament[]>("tournaments/public")
        .then((r) => setTournaments(r.data))
        .catch(() => {});
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [open]);

  const filtered = query.trim()
    ? tournaments.filter((t) =>
        t.name.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : tournaments;

  function handleSelect(t: Tournament) {
    addRecentTournament({ id: t.id, name: t.name });
    navigate(`/tournament/${t.id}`);
    onClose();
  }

  return (
    <BaseModal open={open} onClose={onClose} maxWidth="max-w-lg">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-primary-dark">Search tournaments</h3>
          <p className="text-sm text-gray-500">Open an event.</p>
        </div>
      </div>

      <div className="flex items-center gap-3 border border-gray-200 rounded-lg px-3 py-2 mb-5 focus-within:border-gray-400 transition-colors">
        <FontAwesomeIcon icon={faMagnifyingGlass} className="text-gray-400 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tournaments..."
          className="flex-1 outline-none text-gray-800 text-sm bg-transparent"
        />
      </div>

      <div className="flex flex-col">
        {filtered.length === 0 && (
          <p className="text-sm text-gray-400 italic px-1">No tournaments found.</p>
        )}
        {filtered.map((t) => (
          <button
            key={t.id}
            onClick={() => handleSelect(t)}
            className="flex items-center gap-3 px-1 py-2.5 hover:bg-gray-50 rounded transition-colors text-left"
          >
            {/* Thumbnail */}
            <div
              className={`h-12 w-12 rounded shrink-0 bg-gradient-to-br ${getBannerColor(t.id)} flex items-center justify-center`}
            >
              <span className="text-white font-black text-lg opacity-40 select-none">
                {t.name.charAt(0).toUpperCase()}
              </span>
            </div>

            {/* Info */}
            <div className="flex flex-col min-w-0">
              <span className="text-xs text-gray-400 font-semibold uppercase tracking-wide">
                Tournament
              </span>
              <span className="text-sm font-semibold text-gray-800 truncate">{t.name}</span>
            </div>
          </button>
        ))}
      </div>
    </BaseModal>
  );
}
