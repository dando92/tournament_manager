import { PropsWithChildren, useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleNotch } from '@fortawesome/free-solid-svg-icons';
import BaseModal from '@/shared/components/ui/BaseModal';
import ModalErrors from '@/shared/components/ui/ModalErrors';
import { apiErrorMessage } from '@/shared/lib/apiError';
import { btnDanger, btnPrimary, btnSecondary } from '@/styles/buttonStyles';

/**
 * A dialog that asks nothing and only wants a yes.
 *
 * It is the sibling of `FormModal` for the case with no fields to check: the
 * question is already answered by opening it, so Enter answers yes and Escape
 * answers no, the same two keys as everywhere else. Focus lands on the action
 * for that reason, and the action carries the danger hue, so what Enter is
 * about to do is the thing wearing the focus ring.
 */

type ConfirmModalProps = {
    open: boolean;
    title: string;
    confirmText?: string;
    cancelText?: string;
    /** Destructive by default: this dialog exists mostly to ask before removing something. */
    confirmTone?: 'primary' | 'danger';
    onConfirm: () => void | Promise<void>;
    onClose: () => void;
    failureFallback?: string;
    maxWidth?: string;
};

export default function ConfirmModal({
    open,
    title,
    confirmText = 'Delete',
    cancelText = 'Cancel',
    confirmTone = 'danger',
    onConfirm,
    onClose,
    failureFallback = 'That did not work. Try again.',
    maxWidth = 'max-w-md',
    children,
}: PropsWithChildren<ConfirmModalProps>) {
    const [busy, setBusy] = useState(false);
    const [failure, setFailure] = useState<string | null>(null);
    const confirmRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!open) {
            return;
        }

        setBusy(false);
        setFailure(null);
    }, [open]);

    /* Enter must answer yes, so the action holds the focus even if the dialog's own guess ran first. */
    useEffect(() => {
        if (!open) {
            return;
        }

        const settle = requestAnimationFrame(() => confirmRef.current?.focus());

        return () => cancelAnimationFrame(settle);
    }, [open]);

    const confirm = async () => {
        if (busy) {
            return;
        }

        setBusy(true);
        setFailure(null);
        try {
            await onConfirm();
            onClose();
        } catch (error) {
            setFailure(apiErrorMessage(error, failureFallback));
        } finally {
            setBusy(false);
        }
    };

    return (
        <BaseModal
            open={open}
            onClose={busy ? noop : onClose}
            title={title}
            busy={busy}
            maxWidth={maxWidth}
            initialFocus={confirmRef}
            footer={
                <div className="flex flex-col gap-3">
                    <ModalErrors errors={failure ? [failure] : []} tone="asked" />
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <button type="button" onClick={onClose} disabled={busy} className={`w-full text-sm sm:w-auto ${btnSecondary}`}>
                            {cancelText}
                        </button>
                        <button
                            ref={confirmRef as React.RefObject<HTMLButtonElement>}
                            type="button"
                            onClick={confirm}
                            disabled={busy}
                            className={`w-full text-sm sm:w-auto ${confirmTone === 'danger' ? btnDanger : btnPrimary}`}
                        >
                            {busy ? <FontAwesomeIcon icon={faCircleNotch} spin aria-label="Working" /> : confirmText}
                        </button>
                    </div>
                </div>
            }
        >
            <div className="text-sm text-ui-text-soft">{children}</div>
        </BaseModal>
    );
}

function noop(): void {}
