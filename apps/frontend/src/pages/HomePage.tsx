import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { Tournament } from "@/features/tournament/types/Tournament";
import { addRecentTournament } from "@/features/tournament/services/recentTournaments";
import TournamentCard from "@/features/tournament/components/TournamentCard";
import CreateTournamentModal from "@/features/tournament/modals/CreateTournamentModal";
import SearchTournamentModal from "@/features/tournament/modals/SearchTournamentModal";
import { usePermissions } from "@/shared/services/permissions/PermissionContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";

export default function HomePage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { canCreateTournament } = usePermissions();
  const canCreate = canCreateTournament;

  useEffect(() => {
    if (searchParams.get("create") === "1" && canCreate) {
      setCreateModalOpen(true);
      navigate("/", { replace: true });
    }
  }, [searchParams, canCreate]);

  useEffect(() => {
    axios
      .get<Tournament[]>("tournaments/public")
      .then((r) => setTournaments(r.data))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  function handleSelect(t: Tournament) {
    addRecentTournament({ id: t.id, name: t.name });
    navigate(`/tournament/${t.id}`);
  }

  return (
    <>
      <SearchTournamentModal open={searchModalOpen} onClose={() => setSearchModalOpen(false)} />
      <CreateTournamentModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={(t) => {
          addRecentTournament({ id: t.id, name: t.name });
          navigate(`/tournament/${t.id}`);
        }}
      />

      <div className="flex flex-col gap-8">
        {/* Hero */}
        <div className="flex flex-col items-center gap-4 py-6">
          <h1 className="text-3xl font-black text-gray-900">Tournament Manager</h1>
        </div>

        {/* All tournaments */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">All events</h2>
            <button
              onClick={() => setSearchModalOpen(true)}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
            >
              <FontAwesomeIcon icon={faMagnifyingGlass} className="text-xs" />
              Find tournaments
            </button>
          </div>

          {isLoading && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="rounded-lg overflow-hidden border border-gray-200 animate-pulse">
                  <div className="h-32 bg-gray-200" />
                  <div className="p-3 flex flex-col gap-2">
                    <div className="h-3 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && tournaments.length === 0 && (
            <p className="text-gray-400 text-sm italic">No tournaments yet.</p>
          )}

          {!isLoading && tournaments.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {tournaments.map((t) => (
                <TournamentCard key={t.id} tournament={t} onClick={() => handleSelect(t)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
