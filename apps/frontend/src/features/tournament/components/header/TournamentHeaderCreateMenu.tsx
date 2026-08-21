import type { Dispatch, SetStateAction } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faDiagramProject,
  faLink,
} from "@fortawesome/free-solid-svg-icons";
import { btnPrimary } from "@/styles/buttonStyles";
import { ParticipantsManageModal } from "@/features/tournament/context/TournamentPageContext";

type Props = {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  hasDivisions: boolean;
  hasStartggApiKey: boolean;
  onGenerateBracket: () => void;
  onOpenParticipantsManageModal: Dispatch<SetStateAction<ParticipantsManageModal>>;
};

export default function TournamentHeaderCreateMenu({
  open,
  setOpen,
  hasDivisions,
  hasStartggApiKey,
  onGenerateBracket,
  onOpenParticipantsManageModal,
}: Props) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`flex items-center gap-2 ${btnPrimary}`}
      >
        Actions
        <FontAwesomeIcon icon={faChevronDown} className="text-xs" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-ui-surface rounded shadow-lg border border-ui-border min-w-[240px]">
            <button
              type="button"
              disabled={!hasStartggApiKey}
              title={hasStartggApiKey ? undefined : "Configure the start.gg API key before importing"}
              onClick={() => {
                if (!hasStartggApiKey) return;
                setOpen(false);
                onOpenParticipantsManageModal("startgg");
              }}
              className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-ui-text-soft hover:bg-ui-raised disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FontAwesomeIcon icon={faLink} className="text-ui-text-mute" />
              Import from start.gg
            </button>
            <button
              type="button"
              disabled={!hasDivisions}
              onClick={() => {
                setOpen(false);
                onGenerateBracket();
              }}
              className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-ui-text-soft hover:bg-ui-raised disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FontAwesomeIcon icon={faDiagramProject} className="text-ui-text-mute" />
              Generate bracket
            </button>
          </div>
        </>
      )}
    </div>
  );
}
