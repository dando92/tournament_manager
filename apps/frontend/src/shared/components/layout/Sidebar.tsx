import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faLayerGroup,
  faMagnifyingGlass,
  faPlus,
  faRightFromBracket,
  faRightToBracket,
  faShield,
  faUser,
} from "@fortawesome/free-solid-svg-icons";
import Logo from "@/assets/icon.png";
import { useAuthContext } from "@/features/auth/model/AuthContext";
import SearchTournamentModal from "@/features/tournament/ui/SearchTournamentModal";
import CreateTournamentModal from "@/features/tournament/ui/CreateTournamentModal";
import TournamentTree from "@/features/tournament/ui/tree/TournamentTree";
import { useTournamentTree } from "@/features/tournament/model/TournamentTreeContext";
import { usePermissions } from "@/features/auth/model/PermissionContext";
import { rememberTournament } from "@/shared/lib/recentTournaments";

/**
 * The sidebar: a header that acts on the whole list, the tree, and the account.
 *
 * The two searches it sits between do different jobs and stay apart on
 * purpose. The magnifier here finds a *tournament*; the one in the page header
 * searches *inside* the destination that is open.
 */
export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { state, actions } = useAuthContext();
  const { isAdmin, canCreateTournament } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const tree = useTournamentTree();
  const [searchOpen, setSearchOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const go = (path: string) => {
    navigate(path);
    onNavigate?.();
  };

  return (
    <aside className="flex h-full min-w-0 flex-col bg-ui-canvas">
      <SearchTournamentModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      <CreateTournamentModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(tournament) => {
          rememberTournament({ id: tournament.id, name: tournament.name });
          setCreateOpen(false);
          go(`/tournament/${tournament.id}`);
        }}
      />

      <button
        type="button"
        onClick={() => go("/")}
        className="flex shrink-0 items-center gap-3 border-b border-ui-border p-4 text-left transition-colors hover:bg-ui-raised"
      >
        <img src={Logo} alt="" className="h-9 w-9 shrink-0 rounded-lg" />
        <h2 className="text-sm font-bold leading-tight text-ui-text">
          Tournament
          <br />
          Manager
        </h2>
      </button>

      <div className="flex shrink-0 items-center gap-1 border-b border-ui-border px-3 py-2">
        <span className="flex-1 text-[11px] font-semibold uppercase tracking-wider text-ui-text-mute">Tournaments</span>
        <HeaderButton icon={faLayerGroup} title="Collapse all" onClick={tree.collapseAll} />
        {canCreateTournament && (
          <HeaderButton
            icon={faPlus}
            title="New tournament"
            onClick={() => setCreateOpen(true)}
          />
        )}
        <HeaderButton icon={faMagnifyingGlass} title="Find a tournament" onClick={() => setSearchOpen(true)} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <TournamentTree onNavigate={onNavigate} />
      </div>

      <div className="flex shrink-0 flex-col gap-0.5 border-t border-ui-border p-2">
        {isAdmin && (
          <SidebarLink
            to="/admin/roles"
            icon={faShield}
            active={location.pathname === "/admin/roles"}
            onClick={onNavigate}
          >
            Manage roles
          </SidebarLink>
        )}
        {state.account ? (
          <>
            <SidebarLink to="/account" icon={faUser} active={location.pathname === "/account"} onClick={onNavigate}>
              Account
            </SidebarLink>
            <button
              type="button"
              onClick={() => {
                actions.logout();
                go("/");
              }}
              className="flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm text-ui-text-soft transition-colors hover:bg-ui-raised hover:text-ui-text"
            >
              <FontAwesomeIcon icon={faRightFromBracket} className="w-4 shrink-0" />
              <span>Logout</span>
            </button>
          </>
        ) : (
          <SidebarLink
            to="/login"
            state={{ from: location.pathname }}
            icon={faRightToBracket}
            active={location.pathname === "/login" || location.pathname === "/register"}
            onClick={onNavigate}
          >
            Login / Register
          </SidebarLink>
        )}
      </div>
    </aside>
  );
}

function HeaderButton({ icon, title, onClick }: { icon: IconDefinition; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded text-xs text-ui-text-mute transition-colors hover:bg-ui-raised hover:text-ui-text"
    >
      <FontAwesomeIcon icon={icon} />
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
  icon: IconDefinition;
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      state={state}
      onClick={onClick}
      className={`flex items-center gap-3 rounded px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-ui-selected font-semibold text-ui-text"
          : "text-ui-text-soft hover:bg-ui-raised hover:text-ui-text"
      }`}
    >
      <FontAwesomeIcon icon={icon} className="w-4 shrink-0" />
      <span>{children}</span>
    </Link>
  );
}
