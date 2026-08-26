import { useEffect, useState } from "react";

import BaseModal from "@/shared/components/ui/BaseModal";
import { btnDanger, btnSecondary } from "@/styles/buttonStyles";

export type RemovableMatchItem = {
    id: number;
    label: string;
};

type Props = {
    open: boolean;
    title: string;
    emptyMessage: string;
    items: RemovableMatchItem[];
    onClose: () => void;
    onRemove: (ids: number[]) => void | Promise<void>;
};

export default function RemoveMatchItemsModal({ open, title, emptyMessage, items, onClose, onRemove }: Props) {
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (open) setSelectedIds([]);
    }, [open, items]);

    function toggle(id: number) {
        setSelectedIds((current) => current.includes(id) ? current.filter((candidate) => candidate !== id) : [...current, id]);
    }

    async function handleRemove() {
        setSubmitting(true);
        try {
            await onRemove(selectedIds);
            onClose();
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <BaseModal open={open} onClose={onClose} title={title} maxWidth="max-w-md">
            <div className="flex flex-col gap-4">
                {items.length === 0 ? (
                    <p className="text-sm italic text-ui-text-mute">{emptyMessage}</p>
                ) : (
                    <div className="max-h-[50dvh] overflow-y-auto rounded border border-ui-border bg-ui-row">
                        {items.map((item) => (
                            <label key={item.id} className="flex min-h-11 cursor-pointer items-center gap-3 border-b border-ui-separator px-3 py-2 last:border-b-0 hover:bg-ui-raised">
                                <input
                                    type="checkbox"
                                    checked={selectedIds.includes(item.id)}
                                    onChange={() => toggle(item.id)}
                                    className="rounded"
                                />
                                <span className="min-w-0 flex-1 truncate text-sm text-ui-text" title={item.label}>{item.label}</span>
                            </label>
                        ))}
                    </div>
                )}

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button type="button" onClick={onClose} className={`${btnSecondary} w-full text-sm sm:w-auto`}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleRemove}
                        disabled={submitting || selectedIds.length === 0}
                        className={`${btnDanger} w-full text-sm sm:w-auto`}
                    >
                        {submitting ? "Removing..." : `Remove selected (${selectedIds.length})`}
                    </button>
                </div>
            </div>
        </BaseModal>
    );
}
