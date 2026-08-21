import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { PageTitleProvider } from "@/shared/context/PageTitleContext";
import { SidebarProvider } from "@/shared/context/SidebarContext";
import ProtectedRoute from "@/shared/components/layout/ProtectedRoute";

const MainLayout = lazy(() => import("@/app/MainLayout"));

const HomePage = lazy(() => import("@/pages/HomePage"));
const TournamentPage = lazy(() => import("@/pages/TournamentPage"));
const DivisionPage = lazy(() => import("@/pages/DivisionPage"));
const DivisionPhasesPage = lazy(() => import("@/features/division/pages/DivisionPhasesPage"));
const DivisionPlayersPage = lazy(() => import("@/features/division/pages/DivisionPlayersPage"));
const DivisionSeedingPage = lazy(() => import("@/features/division/pages/DivisionSeedingPage"));
const DivisionStandingsPage = lazy(() => import("@/features/division/pages/DivisionStandingsPage"));
const TournamentOverviewPage = lazy(() => import("@/features/tournament/pages/TournamentOverviewPage"));
const TournamentParticipantsPage = lazy(() => import("@/features/tournament/pages/TournamentParticipantsPage"));
const TournamentSongsPage = lazy(() => import("@/features/tournament/pages/TournamentSongsPage"));
const TournamentLobbiesPage = lazy(() => import("@/features/tournament/pages/TournamentLobbiesPage"));
const TournamentLivePage = lazy(() => import("@/features/tournament/pages/TournamentLivePage"));
const TournamentStatsPage = lazy(() => import("@/features/tournament/pages/TournamentStatsPage"));
const TournamentConfigurationPage = lazy(() => import("@/features/tournament/pages/TournamentConfigurationPage"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const RegisterPage = lazy(() => import("@/pages/RegisterPage"));
const AccountInfoPage = lazy(() => import("@/pages/AccountInfoPage"));
const ManageRolesPage = lazy(() => import("@/pages/ManageRolesPage"));
const OBSPage = lazy(() => import("@/pages/OBSPage"));

function KeyedTournamentPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  return <TournamentPage key={tournamentId ?? "none"} />;
}

export default function AppRouter() {
  return (
    <PageTitleProvider>
      <SidebarProvider>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/obs/:lobbyId" element={<OBSPage />} />

            <Route element={<MainLayout />}>
              <Route path="/" element={<HomePage />} />

              <Route path="/tournament" element={<TournamentPage />} />
              <Route path="/tournament/:tournamentId" element={<KeyedTournamentPage />}>
                <Route index element={<Navigate to="overview" replace />} />
                <Route path="overview" element={<TournamentOverviewPage />} />
                <Route path="participants" element={<TournamentParticipantsPage />} />
                <Route path="songs" element={<TournamentSongsPage />} />
                <Route path="lobbies" element={<TournamentLobbiesPage />} />
                <Route path="live" element={<TournamentLivePage />} />
                <Route path="stats" element={<TournamentStatsPage />} />
                <Route path="configuration" element={<TournamentConfigurationPage />} />
                <Route path="division/:divisionId" element={<DivisionPage />}>
                  <Route index element={<Navigate to="phases" replace />} />
                  <Route path="phases" element={<DivisionPhasesPage />} />
                  <Route path="phases/:phaseId" element={<DivisionPhasesPage />} />
                  <Route path="entrants" element={<DivisionPlayersPage />} />
                  <Route path="seeding" element={<DivisionSeedingPage />} />
                  <Route path="standings" element={<DivisionStandingsPage />} />
                </Route>
              </Route>

              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              <Route element={<ProtectedRoute require="auth" />}>
                <Route path="/account" element={<AccountInfoPage />} />
              </Route>

              <Route element={<ProtectedRoute require="admin" />}>
                <Route path="/admin/roles" element={<ManageRolesPage />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </SidebarProvider>
    </PageTitleProvider>
  );
}
