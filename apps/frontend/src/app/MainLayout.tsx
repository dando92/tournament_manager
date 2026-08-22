import { Suspense, useEffect, useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import Sidebar from "@/shared/components/layout/Sidebar";
import ResizableSidebar from "@/shared/components/layout/ResizableSidebar";
import { MobileBottomNav } from "@/shared/components/layout/MobileNav";
import { TournamentUpdatesProvider } from "@/features/tournament/model/TournamentUpdates";
import { TournamentTreeProvider } from "@/features/tournament/model/TournamentTreeContext";
import { getSelectedTournament, getSidebarTournaments } from "@/shared/lib/recentTournaments";
import { parseTreeSelection } from "@/features/tournament/model/treeSelection";
import { usePermissions } from "@/features/auth/model/PermissionContext";
import "react-toastify/dist/ReactToastify.css";

/**
 * The application shell.
 *
 * The realtime and structure providers are mounted here, above both the
 * sidebar and the page outlet, because the tree draws state derived from the
 * same data the pages show. Mounted inside the outlet — where the realtime
 * provider used to live — the tree would be a sibling of its own data source
 * and its glyphs would freeze at whatever they were on first load.
 *
 * Which tournament is in scope comes from the URL rather than from a stored
 * selection, so a link always lands where it says it does.
 */
export default function MainLayout() {
  const location = useLocation();
  const { canEditTournament } = usePermissions();

  const routeTournamentId = useMemo(
    () => parseTreeSelection(location.pathname)?.tournamentId ?? null,
    [location.pathname],
  );

  /* Scope outlives the route. Browse, account and home carry no tournament in
     their path, and on a phone Browse is exactly where the tree has to still
     know what it is showing — so the last tournament seen stays in scope until
     another one replaces it. */
  const [scopedTournamentId, setScopedTournamentId] = useState<number | null>(
    () => getSelectedTournament()?.id ?? null,
  );
  useEffect(() => {
    if (routeTournamentId !== null && routeTournamentId !== scopedTournamentId) {
      setScopedTournamentId(routeTournamentId);
    }
  }, [routeTournamentId, scopedTournamentId]);

  const tournamentId = routeTournamentId ?? scopedTournamentId;

  /* The name comes from the sidebar's own snapshot: it is only needed to label
     a dialog, and waiting on a request to draw a label is not worth a spinner. */
  const tournamentName = useMemo(() => {
    if (tournamentId === null) return "";
    return getSidebarTournaments().find((entry) => entry.id === tournamentId)?.name ?? "";
  }, [tournamentId]);

  return (
    <TournamentUpdatesProvider key={tournamentId ?? 0} tournamentId={tournamentId ?? 0}>
      <TournamentTreeProvider
        tournamentId={tournamentId}
        tournamentName={tournamentName}
        controls={tournamentId !== null && canEditTournament(tournamentId)}
      >
        <div className="flex h-screen overflow-hidden">
          <ResizableSidebar>
            <Sidebar />
          </ResizableSidebar>

          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <ToastContainer style={{ zIndex: 99999 }} />
            <main className="flex-1 overflow-y-auto p-4 pb-20 md:pb-4">
              <Suspense fallback={null}>
                <Outlet />
              </Suspense>
            </main>
            <MobileBottomNav />
          </div>
        </div>
      </TournamentTreeProvider>
    </TournamentUpdatesProvider>
  );
}
