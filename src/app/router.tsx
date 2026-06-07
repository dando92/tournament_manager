import { Navigate, Outlet, Route, Routes, useParams } from "react-router-dom";
import { PageTitleProvider } from "@/shared/context/PageTitleContext";
import { SidebarProvider } from "@/shared/context/SidebarContext";
import "./App.css";
import HomePage from "@/pages/HomePage";
import TournamentPage from "@/pages/TournamentPage";
import DivisionPage from "@/pages/DivisionPage";
import DivisionPhasesPage from "@/features/division/pages/DivisionPhasesPage";
import DivisionPlayersPage from "@/features/division/pages/DivisionPlayersPage";
import DivisionStandingsPage from "@/features/division/pages/DivisionStandingsPage";
import TournamentOverviewPage from "@/features/tournament/pages/TournamentOverviewPage";
import TournamentParticipantsPage from "@/features/tournament/pages/TournamentParticipantsPage";
import TournamentSongsPage from "@/features/tournament/pages/TournamentSongsPage";
import TournamentLobbiesPage from "@/features/tournament/pages/TournamentLobbiesPage";
import TournamentLivePage from "@/features/tournament/pages/TournamentLivePage";
import TournamentStatsPage from "@/features/tournament/pages/TournamentStatsPage";
import TournamentConfigurationPage from "@/features/tournament/pages/TournamentConfigurationPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import AccountInfoPage from "@/pages/AccountInfoPage";
import ManageRolesPage from "@/pages/ManageRolesPage";
import OBSPage from "@/pages/OBSPage";
import Sidebar from "@/shared/components/layout/Sidebar";
import { MobileBottomNav } from "@/shared/components/layout/MobileNav";
import ProtectedRoute from "@/shared/components/layout/ProtectedRoute";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function KeyedTournamentPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  return <TournamentPage key={tournamentId ?? "none"} />;
}

function MainLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <ToastContainer style={{ zIndex: 99999 }} />
        <main className="flex-1 overflow-y-auto p-4 pb-20 md:pb-4">
          <Outlet />
        </main>
        <MobileBottomNav />
      </div>
    </div>
  );
}

export default function AppRouter() {
  return (
    <PageTitleProvider>
      <SidebarProvider>
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
      </SidebarProvider>
    </PageTitleProvider>
  );
}
