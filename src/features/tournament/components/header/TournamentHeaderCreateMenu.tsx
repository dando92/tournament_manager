import type { Dispatch, SetStateAction } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faDiagramProject,
  faLayerGroup,
  faPlus,
} from "@fortawesome/free-solid-svg-icons";
import { btnPrimary } from "@/styles/buttonStyles";

type Props = {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  showCreateDivision: boolean;
  showCreatePhaseGroup: boolean;
  hasDivisions: boolean;
  hasCurrentDivisionPhases: boolean;
  onCreateDivision: () => void;
  onGenerateBracket: () => void;
  onCreatePhase: () => void;
  onCreatePhaseGroup: () => void;
};

export default function TournamentHeaderCreateMenu({
  open,
  setOpen,
  showCreateDivision,
  showCreatePhaseGroup,
  hasDivisions,
  hasCurrentDivisionPhases,
  onCreateDivision,
  onGenerateBracket,
  onCreatePhase,
  onCreatePhaseGroup,
}: Props) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`flex items-center gap-2 ${btnPrimary}`}
      >
        Create
        <FontAwesomeIcon icon={faChevronDown} className="text-xs" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded shadow-lg border border-gray-200 min-w-[240px]">
            {showCreateDivision && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onCreateDivision();
                }}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                <FontAwesomeIcon icon={faPlus} className="text-primary-dark" />
                New division
              </button>
            )}
            <button
              type="button"
              disabled={!hasDivisions}
              onClick={() => {
                setOpen(false);
                onGenerateBracket();
              }}
              className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FontAwesomeIcon icon={faDiagramProject} className="text-primary-dark" />
              Generate bracket
            </button>
            <button
              type="button"
              disabled={!hasDivisions}
              onClick={() => {
                setOpen(false);
                onCreatePhase();
              }}
              className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FontAwesomeIcon icon={faLayerGroup} className="text-primary-dark" />
              Phase
            </button>
            {showCreatePhaseGroup && (
              <button
                type="button"
                disabled={!hasCurrentDivisionPhases}
                onClick={() => {
                  setOpen(false);
                  onCreatePhaseGroup();
                }}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FontAwesomeIcon icon={faLayerGroup} className="text-primary-dark" />
                Phase group
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
