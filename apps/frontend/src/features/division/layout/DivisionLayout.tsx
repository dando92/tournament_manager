import { Suspense } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { DIVISION_TABS, DivisionTabKey } from "@/features/division/config/divisionTabs";
import { DivisionPageContextValue } from "@/features/division/context/DivisionPageContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft } from "@fortawesome/free-solid-svg-icons";

type DivisionLayoutProps = {
  context: DivisionPageContextValue;
};

export default function DivisionLayout({ context }: DivisionLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { division, tournamentId, divisionId } = context;

  const activeTab: DivisionTabKey =
    DIVISION_TABS.find((tab) => location.pathname.endsWith(`/${tab.key}`))?.key ?? "phases";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(`/tournament/${tournamentId}/overview`)}
          className="text-ui-text-mute hover:text-ui-text-soft flex items-center gap-1.5 text-sm"
        >
          <FontAwesomeIcon icon={faChevronLeft} className="text-xs" />
          Back to overview
        </button>
        <span className="text-ui-border-strong">/</span>
        <span className="text-sm font-semibold text-ui-text-soft">{division.name}</span>
      </div>

      <div className="flex items-end border-b border-ui-border overflow-x-auto">
        {DIVISION_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => navigate(`/tournament/${tournamentId}/division/${divisionId}/${tab.key}`)}
            className={`px-4 py-2 text-sm border-b-2 shrink-0 transition-colors ${
              activeTab === tab.key
                ? "border-ui-border-strong text-ui-text font-semibold"
                : "border-transparent text-ui-text-mute hover:text-ui-text-soft hover:border-ui-border-strong"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Suspense fallback={null}>
        <Outlet context={context} />
      </Suspense>
    </div>
  );
}
