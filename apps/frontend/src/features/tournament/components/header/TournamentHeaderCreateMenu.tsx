import type { Dispatch, SetStateAction } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faDiagramProject,
  faLink,
  faLayerGroup,
  faPlus,
} from "@fortawesome/free-solid-svg-icons";
import { btnPrimary } from "@/styles/buttonStyles";
import { ParticipantsManageModal } from "@/features/tournament/context/TournamentPageContext";

type Props = {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  showCreateDivision: boolean;
  hasDivisions: boolean;
  hasStartggApiKey: boolean;
  onCreateDivision: () => void;
  onGenerateBracket: () => void;
  onCreatePhase: () => void;
  onOpenParticipantsManageModal: Dispatch<SetStateAction<ParticipantsManageModal>>;
};

export default function TournamentHeaderCreateMenu({
  open,
  setOpen,
  showCreateDivision,
  hasDivisions,
  hasStartggApiKey,
  onCreateDivision,
  onGenerateBracket,
  onCreatePhase,
  onOpenParticipantsManageModal,
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
              disabled={!hasStartggApiKey}
              title={hasStartggApiKey ? undefined : "Configure the start.gg API key before importing"}
              onClick={() => {
                if (!hasStartggApiKey) return;
                setOpen(false);
                onOpenParticipantsManageModal("startgg");
              }}
              className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FontAwesomeIcon icon={faLink} className="text-primary-dark" />
              Import from start.gg
            </button>
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
          </div>
        </>
      )}
    </div>
  );
}
