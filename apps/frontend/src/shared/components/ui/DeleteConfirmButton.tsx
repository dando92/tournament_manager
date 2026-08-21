import { useState } from "react";
import type { ReactNode } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash } from "@fortawesome/free-solid-svg-icons";
import BaseModal from "@/shared/components/ui/BaseModal";
import { btnDanger, btnSecondary, btnTrash } from "@/styles/buttonStyles";

type DeleteConfirmButtonProps = {
  onConfirm: () => void | Promise<void>;
  title?: string;
  confirmTitle?: string;
  confirmMessage?: string;
  confirmText?: string;
  className?: string;
  iconClassName?: string;
  disabled?: boolean;
  stopPropagation?: boolean;
  children?: ReactNode;
};

export default function DeleteConfirmButton({
  onConfirm,
  title = "Delete",
  confirmTitle = "Confirm deletion",
  confirmMessage = "This action cannot be undone.",
  confirmText = "Delete",
  className = "",
  iconClassName,
  disabled = false,
  stopPropagation = false,
  children,
}: DeleteConfirmButtonProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        title={title}
        disabled={disabled}
        onClick={(event) => {
          if (stopPropagation) event.stopPropagation();
          setOpen(true);
        }}
        className={`${btnTrash} ${className}`}
      >
        <FontAwesomeIcon icon={faTrash} className={iconClassName} />
        {children}
      </button>

      <BaseModal open={open} onClose={() => setOpen(false)} title={confirmTitle} maxWidth="max-w-md">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ui-text-soft">{confirmMessage}</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={`${btnSecondary} w-full text-sm sm:w-auto`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              className={`${btnDanger} w-full text-sm sm:w-auto`}
            >
              {submitting ? "Deleting..." : confirmText}
            </button>
          </div>
        </div>
      </BaseModal>
    </>
  );
}
