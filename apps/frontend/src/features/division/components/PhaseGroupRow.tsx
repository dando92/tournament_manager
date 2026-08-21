import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import PhaseGroupActionsMenu from "@/features/division/components/PhaseGroupActionsMenu";
import PhaseGroupContent from "@/features/division/components/PhaseGroupContent";
import { usePhaseGroupActions } from "@/features/division/hooks/usePhaseGroupActions";
import { Division } from "@/features/division/types/Division";
import { Phase, PhaseGroup } from "@/features/division/types/Phase";
import { MatchHighlight } from "@/features/match/types/Match";
import { formatBracketType } from "@/features/division/utils/bracketType";

type PhaseGroupRowProps = {
  phase: Phase;
  phaseGroup: PhaseGroup;
  division: Division;
  controls: boolean;
  tournamentId?: number;
  highlight: MatchHighlight;
  onHighlight: (highlight: MatchHighlight) => void;
  onChanged?: () => Promise<void>;
};

function phaseGroupStateClass(state: PhaseGroup["state"]): string {
  switch (state) {
    case "active":
      return "bg-green-50 text-green-800";
    case "completed":
      return "bg-blue-50 text-blue-800";
    case "pending":
    default:
      return "bg-gray-100 text-gray-600";
  }
}

export default function PhaseGroupRow({
  phase,
  phaseGroup,
  division,
  controls,
  tournamentId,
  highlight,
  onHighlight,
  onChanged,
}: PhaseGroupRowProps) {
  const [expanded, setExpanded] = useState(false);
  const actions = usePhaseGroupActions({ division, phaseGroup, onChanged });
  const bracketTypeLabel = formatBracketType(phaseGroup.bracketType);
  const isHighlighted = highlight.phaseGroupId === phaseGroup.id;

  return (
    <div className={`border rounded-md bg-white overflow-visible transition-shadow ${
      isHighlighted
        ? "border-green-400 ring-2 ring-green-300 shadow-green-100 shadow-lg"
        : "border-gray-200"
    }`}>
      <div className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="min-w-0 flex flex-1 items-center gap-3 text-left"
        >
          <FontAwesomeIcon icon={expanded ? faChevronDown : faChevronRight} className="text-gray-500 w-3 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-800">{phaseGroup.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${phaseGroupStateClass(phaseGroup.state)}`}>
                {phaseGroup.state}
              </span>
              {bracketTypeLabel && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{bracketTypeLabel}</span>
              )}
              <span className="text-xs text-gray-400">
                {phaseGroup.matchCount} match{phaseGroup.matchCount !== 1 ? "es" : ""}
              </span>
            </div>
          </div>
        </button>
        {controls && (
          <PhaseGroupActionsMenu
            phaseGroupName={phaseGroup.name}
            disabled={actions.saving || actions.deleting}
            deleting={actions.deleting}
            onCreateMatch={actions.openCreateMatch}
            onEditAdvancementRules={actions.beginAdvancementEdit}
            onDeletePhaseGroup={actions.removePhaseGroup}
          />
        )}
      </div>
      <PhaseGroupContent
        phase={phase}
        phaseGroup={phaseGroup}
        division={division}
        controls={controls}
        tournamentId={tournamentId}
        highlight={highlight}
        onHighlight={onHighlight}
        actions={actions}
        showMatches={expanded}
        bodyClassName="px-4 pb-4 border-t border-gray-100"
      />
    </div>
  );
}
