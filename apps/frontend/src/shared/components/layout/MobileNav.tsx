import { useLocation, useNavigate } from "react-router-dom";
import SearchTournamentModal from "@/features/tournament/modals/SearchTournamentModal";
import { useAuthContext } from "@/features/auth/context/AuthContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faMagnifyingGlass,
  faRightToBracket,
  faRightFromBracket,
} from "@fortawesome/free-solid-svg-icons";
import { useSidebar } from "@/shared/context/SidebarContext";
import { useState } from "react";

// Bottom navigation bar — visible only on mobile
export function MobileBottomNav() {
  const { state, actions } = useAuthContext();
  const { toggle } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  const isOnAccount =
    location.pathname === "/account" ||
    location.pathname === "/login" ||
    location.pathname === "/register";

  function handleLogout() {
    actions.logout();
    navigate("/");
  }

  return (
    <>
    <SearchTournamentModal open={searchModalOpen} onClose={() => setSearchModalOpen(false)} />
    <nav className="flex md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 h-14">
      {/* Left: menu button */}
      <button
        onClick={toggle}
        className="flex flex-col items-center justify-center gap-0.5 flex-1 py-2 text-xs text-gray-500 hover:text-primary-dark transition-colors"
      >
        <FontAwesomeIcon icon={faBars} className="text-xl" />
        <span>Menu</span>
      </button>

      {/* Center: search */}
      <button
        onClick={() => setSearchModalOpen(true)}
        className="flex flex-col items-center justify-center gap-0.5 flex-1 py-2 text-xs transition-colors text-gray-500 hover:text-primary-dark"
      >
        <FontAwesomeIcon icon={faMagnifyingGlass} className="text-xl" />
        <span>Search</span>
      </button>

      {/* Right: login/logout */}
      {state.account ? (
        <button
          onClick={handleLogout}
          className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 text-xs transition-colors ${
            isOnAccount ? "text-primary-dark font-semibold" : "text-gray-500"
          }`}
        >
          <FontAwesomeIcon icon={faRightFromBracket} className="text-xl" />
          <span>Logout</span>
        </button>
      ) : (
        <button
          onClick={() => navigate("/login", { state: { from: location.pathname } })}
          className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 text-xs transition-colors ${
            isOnAccount ? "text-primary-dark font-semibold" : "text-gray-500"
          }`}
        >
          <FontAwesomeIcon icon={faRightToBracket} className="text-xl" />
          <span>Login</span>
        </button>
      )}
    </nav>
    </>
  );
}
