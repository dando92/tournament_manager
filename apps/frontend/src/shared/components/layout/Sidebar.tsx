import { Link, useNavigate, useLocation } from "react-router-dom";
import Logo from "@/assets/icon.png";
import { useAuthContext } from "@/features/auth/context/AuthContext";
import { useLayoutEffect, useRef, useState } from "react";
import SearchTournamentModal from "@/features/tournament/modals/SearchTournamentModal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMagnifyingGlass,
  faPlus,
  faShield,
  faUser,
  faRightFromBracket,
  faRightToBracket,
  faTrophy,
} from "@fortawesome/free-solid-svg-icons";
import {
  getRecentTournaments,
  selectRecentTournament,
  type RecentTournament,
} from "@/features/tournament/services/recentTournaments";
import { useSidebar } from "@/shared/context/SidebarContext";
import { usePermissions } from "@/shared/services/permissions/PermissionContext";
import { TOURNAMENT_TABS } from "@/features/tournament/config/tournamentTabs";

function ScrollingText({ text }: { text: string }) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [shouldScroll, setShouldScroll] = useState(false);

  useLayoutEffect(() => {
    if (containerRef.current && textRef.current) {
      setShouldScroll(textRef.current.scrollWidth > containerRef.current.offsetWidth);
    }
  }, [text]);

  return (
    <span ref={containerRef} className="overflow-hidden block min-w-0 flex-1" title={text}>
      <span
        ref={textRef}
        className={`block whitespace-nowrap ${shouldScroll ? "animate-marquee" : ""}`}
      >
        {text}
      </span>
    </span>
  );
}

function TournamentButton({
  tournament,
  selected,
  onClick,
}: {
  tournament: RecentTournament;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={tournament.name}
      className={`flex items-center gap-2 px-2 py-2 rounded text-sm transition-colors w-full text-left ${
        selected
          ? "bg-ui-selected text-ui-text font-semibold"
          : "text-ui-text-soft hover:bg-ui-raised hover:text-ui-text"
      }`}
    >
      {tournament.logo ? (
        <img
          src={tournament.logo}
          alt=""
          className="h-6 w-6 rounded shrink-0 object-cover"
        />
      ) : (
        <FontAwesomeIcon icon={faTrophy} className="w-4 shrink-0" />
      )}
      <ScrollingText text={tournament.name} />
    </button>
  );
}

function SidebarLink({
  to,
  state,
  icon,
  children,
  active,
  onClick,
}: {
  to: string;
  state?: unknown;
  icon?: React.ComponentProps<typeof FontAwesomeIcon>["icon"];
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      state={state}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${
        active
          ? "bg-ui-selected text-ui-text font-semibold"
          : "text-ui-text-soft hover:bg-ui-raised hover:text-ui-text"
      }`}
    >
      {icon && <FontAwesomeIcon icon={icon} className="w-4 shrink-0" />}
      <span>{children}</span>
    </Link>
  );
}

export default function Sidebar() {
  const { state, actions } = useAuthContext();
  const { isAdmin, canCreateTournament, canEditTournament } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const { isOpen, close } = useSidebar();

  const [recentTournaments, setRecentTournaments] = useState<RecentTournament[]>(
    getRecentTournaments,
  );

  const prevPathname = useRef(location.pathname);
  useLayoutEffect(() => {
    if (prevPathname.current !== location.pathname) {
      prevPathname.current = location.pathname;
      setRecentTournaments(getRecentTournaments());
    }
  }, [location.pathname]);

  function handleLogout() {
    actions.logout();
    navigate("/");
    close();
  }

  const selectedTournament = recentTournaments[0] ?? null;
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  function handleTournamentClick(t: RecentTournament) {
    selectRecentTournament(t.id);
    setRecentTournaments(getRecentTournaments());
    close();

    navigate(`/tournament/${t.id}`);
  }

  const tournamentMatch = location.pathname.match(/^\/tournament\/(\d+)(?:\/([^/]+))?/);
  const currentTournamentId = tournamentMatch ? Number(tournamentMatch[1]) : null;
  const visibleTournamentTabs = TOURNAMENT_TABS.filter((tab) => {
    if (tab.key === "participants" || tab.key === "configuration") {
      return currentTournamentId !== null && canEditTournament(currentTournamentId);
    }
    if (tab.key !== "lobbies") return true;
    return currentTournamentId !== null && canEditTournament(currentTournamentId);
  });
  const currentTournamentTab = visibleTournamentTabs.find((tab) =>
    location.pathname.endsWith(`/${tab.key}`),
  )?.key;

  const content = (
    <aside className="flex flex-col w-56 h-full bg-ui-canvas border-r border-ui-border">
      <button
        type="button"
        onClick={() => {
          navigate("/");
          close();
        }}
        className="flex items-center gap-3 p-4 border-b border-ui-border shrink-0 text-left hover:bg-ui-raised transition-colors"
      >
        <img src={Logo} alt="logo" className="h-10 w-10 rounded-lg shrink-0" />
        <h2 className="text-ui-text font-bold text-base leading-tight">
          Tournament<br />Manager
        </h2>
      </button>

      <div className="p-3 border-b border-ui-border shrink-0 flex flex-col gap-2">
        {canCreateTournament && (
          <button
            onClick={() => { navigate(state.account ? "/?create=1" : "/login"); close(); }}
            className="flex items-center justify-center gap-2 w-full border border-ui-border bg-ui-surface hover:bg-ui-raised text-ui-text text-sm font-semibold px-3 py-2 rounded transition-colors"
          >
            <FontAwesomeIcon icon={faPlus} className="text-xs" />
            Create tournament
          </button>
        )}
        <button
          onClick={() => setSearchModalOpen(true)}
          className="flex items-center justify-center gap-2 w-full border border-ui-border bg-ui-surface hover:bg-ui-raised text-ui-text text-sm font-semibold px-3 py-2 rounded transition-colors"
        >
          <FontAwesomeIcon icon={faMagnifyingGlass} className="text-xs" />
          Search tournament
        </button>
      </div>

      <div className="flex flex-col gap-0.5 p-3 border-b border-ui-border shrink-0">
        <p className="text-ui-text-soft text-xs uppercase tracking-wide mb-1 px-1">Recent tournaments</p>
        {recentTournaments.length > 0 ? (
          recentTournaments.map((t) => (
            <TournamentButton
              key={t.id}
              tournament={t}
              selected={t.id === selectedTournament?.id}
              onClick={() => handleTournamentClick(t)}
            />
          ))
        ) : (
          <p className="text-ui-text-mute text-xs px-1 italic">No recent tournaments</p>
        )}
      </div>

      {currentTournamentId !== null && (
        <div className="flex flex-col gap-0.5 p-3 border-b border-ui-border shrink-0">
          <p className="text-ui-text-soft text-xs uppercase tracking-wide mb-1 px-1">Tournament</p>
          {visibleTournamentTabs.map((tab) => (
            <SidebarLink
              key={tab.key}
              to={`/tournament/${currentTournamentId}/${tab.key}`}
              active={currentTournamentTab === tab.key}
              onClick={close}
            >
              {tab.label}
            </SidebarLink>
          ))}
        </div>
      )}

      <div className="flex-1" />

      <div className="flex flex-col gap-0.5 p-3 border-t border-ui-border shrink-0">
        {isAdmin && (
          <SidebarLink
            to="/admin/roles"
            icon={faShield}
            active={location.pathname === "/admin/roles"}
            onClick={close}
          >
            Manage Roles
          </SidebarLink>
        )}
        {state.account && (
          <SidebarLink
            to="/account"
            icon={faUser}
            active={location.pathname === "/account"}
            onClick={close}
          >
            Account
          </SidebarLink>
        )}
        {state.account ? (
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded text-sm text-ui-text-soft hover:bg-ui-raised hover:text-ui-text transition-colors text-left w-full"
          >
            <FontAwesomeIcon icon={faRightFromBracket} className="w-4 shrink-0" />
            <span>Logout</span>
          </button>
        ) : (
          <SidebarLink
            to="/login"
            state={{ from: location.pathname }}
            icon={faRightToBracket}
            active={
              location.pathname === "/login" || location.pathname === "/register"
            }
            onClick={close}
          >
            Login / Register
          </SidebarLink>
        )}
      </div>
    </aside>
  );

  return (
    <>
      <SearchTournamentModal open={searchModalOpen} onClose={() => setSearchModalOpen(false)} />

      <div className="hidden md:flex min-h-screen shrink-0">{content}</div>

      {isOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={close}
          />
          <div className="relative z-10 flex h-full">{content}</div>
        </div>
      )}
    </>
  );
}
