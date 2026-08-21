import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faDatabase, faFileImport, faPlus } from "@fortawesome/free-solid-svg-icons";
import { useState } from "react";
import { ParticipantsManageModal } from "@/features/tournament/context/TournamentPageContext";
import { btnPrimary } from "@/styles/buttonStyles";

type Props = {
  onOpen: React.Dispatch<React.SetStateAction<ParticipantsManageModal>>;
};

export default function TournamentHeaderParticipantsManageMenu({ onOpen }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  const openModal = (modal: ParticipantsManageModal) => {
    setMenuOpen(false);
    onOpen(modal);
  };

  return (
    <div className="relative">
      <button type="button" onClick={() => setMenuOpen((value) => !value)} className={`flex items-center gap-2 ${btnPrimary}`}>
        Manage
        <FontAwesomeIcon icon={faChevronDown} className="text-xs" />
      </button>
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 min-w-[220px] rounded border border-gray-200 bg-white shadow-lg">
            <button
              type="button"
              onClick={() => openModal("register")}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              <FontAwesomeIcon icon={faPlus} className="text-brand-700" />
              Register participant
            </button>
            <button
              type="button"
              onClick={() => openModal("database")}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              <FontAwesomeIcon icon={faDatabase} className="text-brand-700" />
              Add from player database
            </button>
            <button
              type="button"
              onClick={() => openModal("import")}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              <FontAwesomeIcon icon={faFileImport} className="text-brand-700" />
              Import names
            </button>
          </div>
        </>
      )}
    </div>
  );
}
