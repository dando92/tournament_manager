import { ReactNode, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEllipsisVertical } from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import BaseModal from "@/shared/components/ui/BaseModal";
import { btnDanger, btnSecondary } from "@/styles/buttonStyles";

export type ActionsMenuItem = {
  key: string;
  label: string;
  icon: IconDefinition | ReactNode;
  onSelect: () => void | Promise<void>;
  danger?: boolean;
  disabled?: boolean;
  hidden?: boolean;
  /** Extra classes on the row, for an item that only belongs to some viewports. */
  className?: string;
  /** When set, the item asks for confirmation in a dialog before running. */
  confirm?: {
    title?: string;
    message: string;
    confirmText?: string;
  };
};

type ActionsMenuProps = {
  title: string;
  items: ActionsMenuItem[];
  disabled?: boolean;
  busy?: boolean;
  /** Replaces the trigger styling, for a menu that sits on a coloured surface. */
  triggerClassName?: string;
  /** Which edge the panel is anchored to. Use "left" for a trigger near the left of the page. */
  align?: "left" | "right";
};

export default function ActionsMenu({
  title,
  items,
  disabled = false,
  busy = false,
  triggerClassName,
  align = "right",
}: ActionsMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState<ActionsMenuItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const visibleItems = items.filter((item) => !item.hidden);

  if (visibleItems.length === 0) return null;

  const runConfirmed = async () => {
    if (!confirming) return;
    setSubmitting(true);
    try {
      await confirming.onSelect();
      setConfirming(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        title={title}
        onClick={() => setMenuOpen((current) => !current)}
        disabled={disabled}
        className={`flex h-8 w-8 items-center justify-center p-0 text-sm disabled:cursor-not-allowed ${triggerClassName ?? btnSecondary}`}
      >
        <FontAwesomeIcon icon={faEllipsisVertical} />
      </button>
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
          <div
            className={`absolute top-full z-20 mt-1 min-w-[220px] rounded border border-gray-200 bg-white py-1 shadow-lg ${
              align === "left" ? "left-0" : "right-0"
            }`}
          >
            {visibleItems.map((item) => (
              <button
                key={item.key}
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  setMenuOpen(false);
                  if (item.confirm) {
                    setConfirming(item);
                    return;
                  }
                  item.onSelect();
                }}
                className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm disabled:cursor-not-allowed disabled:opacity-40 ${
                  item.danger ? "text-red-600 hover:bg-red-50" : "text-gray-700 hover:bg-gray-50"
                } ${item.className ?? ""}`}
              >
                <ItemIcon icon={item.icon} danger={item.danger} />
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}

      <BaseModal
        open={Boolean(confirming)}
        onClose={() => setConfirming(null)}
        title={confirming?.confirm?.title ?? "Confirm deletion"}
        maxWidth="max-w-md"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600">{confirming?.confirm?.message}</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setConfirming(null)}
              className={`${btnSecondary} w-full text-sm sm:w-auto`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={runConfirmed}
              disabled={submitting || busy}
              className={`${btnDanger} w-full text-sm sm:w-auto`}
            >
              {submitting || busy ? "Deleting..." : confirming?.confirm?.confirmText ?? "Delete"}
            </button>
          </div>
        </div>
      </BaseModal>
    </div>
  );
}

function ItemIcon({ icon, danger }: { icon: ActionsMenuItem["icon"]; danger?: boolean }) {
  const className = danger ? undefined : "text-primary-dark";
  if (icon && typeof icon === "object" && "iconName" in icon) {
    return <FontAwesomeIcon icon={icon as IconDefinition} className={className} />;
  }
  return <span className={className}>{icon}</span>;
}
