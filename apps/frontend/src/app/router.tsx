import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { PageTitleProvider } from "@/shared/context/PageTitleContext";
import ProtectedRoute from "@/shared/components/layout/ProtectedRoute";

const MainLayout = lazy(() => import("@/app/MainLayout"));

const HomePage = lazy(() => import("@/pages/HomePage"));
const BrowsePage = lazy(() => import("@/pages/BrowsePage"));
const TournamentPage = lazy(() => import("@/pages/tournament/TournamentPage"));
const DivisionPage = lazy(() => import("@/pages/tournament/division/DivisionPage"));
const DivisionMatchesPage = lazy(() => import("@/pages/tournament/division/MatchesPage"));
const DivisionPlayersPage = lazy(() => import("@/pages/tournament/division/PlayersPage"));
const DivisionSeedingPage = lazy(() => import("@/pages/tournament/division/SeedingPage"));
const SchedulePage = lazy(() => import("@/pages/tournament/SchedulePage"));
const ParticipantsPage = lazy(() => import("@/pages/tournament/ParticipantsPage"));
const SongsPage = lazy(() => import("@/pages/tournament/SongsPage"));
const LobbiesPage = lazy(() => import("@/pages/tournament/LobbiesPage"));
const LivePage = lazy(() => import("@/pages/tournament/LivePage"));
const ControlRoomPage = lazy(() => import("@/pages/tournament/ControlRoomPage"));
const StatsPage = lazy(() => import("@/pages/tournament/StatsPage"));
const ConfigurationPage = lazy(() => import("@/pages/tournament/ConfigurationPage"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const RegisterPage = lazy(() => import("@/pages/RegisterPage"));
const AccountInfoPage = lazy(() => import("@/pages/account/AccountInfoPage"));
const TournamentManagerConfigurationPage = lazy(
  () => import("@/pages/configuration/TournamentManagerConfigurationPage"),
);
const OBSPage = lazy(() => import("@/pages/OBSPage"));

function KeyedTournamentPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  return <TournamentPage key={tournamentId ?? "none"} />;
}

/**
 * Every node the tree can select is an address.
 *
 * A branch — a division, a phase, a pool — opens the same flat match list at a
 * different depth, so the three routes share one page. The match a viewer has
 * open is a `?match=` search parameter rather than another segment: it is a
 * sub-state of the list, not another destination, so the back button closes it
 * without reloading the scope.
 */
export default function AppRouter() {
  return (
    <PageTitleProvider>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/obs/:lobbyId" element={<OBSPage />} />

          <Route element={<MainLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/browse" element={<BrowsePage />} />

            <Route path="/tournament" element={<TournamentPage />} />
            <Route path="/tournament/:tournamentId" element={<KeyedTournamentPage />}>
              <Route index element={<Navigate to="schedule" replace />} />
              <Route path="schedule" element={<SchedulePage />} />
              {/* The board replaced the overview; a link somebody kept still lands on it. */}
              <Route path="overview" element={<Navigate to="../schedule" replace />} />
              <Route path="participants" element={<ParticipantsPage />} />
              <Route path="songs" element={<SongsPage />} />
              <Route path="lobbies" element={<LobbiesPage />} />
              <Route path="live" element={<LivePage />} />
              <Route path="control-room" element={<ControlRoomPage />} />
              <Route path="stats" element={<StatsPage />} />
              <Route path="configuration" element={<ConfigurationPage />} />

              <Route path="division/:divisionId" element={<DivisionPage />}>
                <Route index element={<DivisionMatchesPage />} />
                <Route path="phase/:phaseId" element={<DivisionMatchesPage />} />
                <Route path="phase/:phaseId/pool/:poolId" element={<DivisionMatchesPage />} />
                <Route path="entrants" element={<DivisionPlayersPage />} />
                <Route path="seeding" element={<DivisionSeedingPage />} />
              </Route>
            </Route>

            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/configuration" element={<TournamentManagerConfigurationPage />} />

            <Route element={<ProtectedRoute require="auth" />}>
              <Route path="/account" element={<AccountInfoPage />} />
            </Route>

            <Route element={<ProtectedRoute require="admin" />}>
              <Route path="/admin/roles" element={<Navigate to="/configuration" replace />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </PageTitleProvider>
  );
}
