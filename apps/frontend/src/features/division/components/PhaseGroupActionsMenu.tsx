import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDice, faEllipsisVertical, faPenToSquare, faTrash } from "@fortawesome/free-solid-svg-icons";
import BaseModal from "@/shared/components/ui/BaseModal";
import { btnDanger, btnSecondary } from "@/styles/buttonStyles";

type PhaseGroupActionsMenuProps = {
  phaseGroupName: string;
  disabled?: boolean;
  deleting?: boolean;
  onCreateMatch: () => void;
  onEditAdvancementRules: () => void | Promise<void>;
  onDeletePhaseGroup: () => void | Promise<void>;
};

export default function PhaseGroupActionsMenu({
  phaseGroupName,
  disabled = false,
  deleting = false,
  onCreateMatch,
  onEditAdvancementRules,
  onDeletePhaseGroup,
}: PhaseGroupActionsMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        title="Phase group actions"
        onClick={() => setMenuOpen((current) => !current)}
        disabled={disabled}
        className={`${btnSecondary} flex h-8 w-8 items-center justify-center p-0 text-sm disabled:cursor-not-allowed`}
      >
        <FontAwesomeIcon icon={faEllipsisVertical} />
      </button>
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 min-w-[220px] rounded border border-gray-200 bg-white shadow-lg">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onCreateMatch();
              }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              <FontAwesomeIcon icon={faDice} className="text-primary-dark" />
              Create match
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onEditAdvancementRules();
              }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              <FontAwesomeIcon icon={faPenToSquare} className="text-primary-dark" />
              Edit advancement rules
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setDeleteConfirmOpen(true);
              }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
            >
              <FontAwesomeIcon icon={faTrash} />
              Delete phase group
            </button>
          </div>
        </>
      )}

      <BaseModal open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title="Confirm deletion" maxWidth="max-w-md">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600">Delete phase group "{phaseGroupName}"?</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setDeleteConfirmOpen(false)} className={`${btnSecondary} text-sm`}>
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                await onDeletePhaseGroup();
                setDeleteConfirmOpen(false);
              }}
              disabled={deleting}
              className={`${btnDanger} text-sm`}
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </BaseModal>
    </div>
  );
}
