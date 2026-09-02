import { FormEvent, KeyboardEvent as ReactKeyboardEvent, MutableRefObject, PropsWithChildren, ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleNotch } from '@fortawesome/free-solid-svg-icons';
import BaseModal from '@/shared/components/ui/BaseModal';
import ModalErrors from '@/shared/components/ui/ModalErrors';
import { apiErrorMessage } from '@/shared/lib/apiError';
import { btnDanger, btnPrimary, btnSecondary } from '@/styles/buttonStyles';

/**
 * A dialog that asks for something, checks it, and does it.
 *
 * What every such dialog owes the person using it lives here rather than in
 * each one: the first field takes focus on open, Enter submits, Escape leaves,
 * and nothing invalid gets through. Success is silent — the modal closes and
 * the page behind it shows what happened; when the result lives somewhere
 * else, the caller navigates there instead of reporting it. Only failure keeps
 * the modal open, with everything typed still in it, because an error that
 * disappears is an error nobody read.
 */

type FormModalProps = {
    open: boolean;
    title: string;
    confirmText?: string;
    /** Destructive confirmations keep the hue that says so; everything else is ranked by surface. */
    confirmTone?: 'primary' | 'danger';
    cancelText?: string;
    /**
     * Every reason the form may not be submitted yet, in the order they should
     * be read. Empty means it may. Called during render, so it reads state and
     * decides nothing.
     */
    validate?: () => string[];
    /**
     * The work. Resolving closes the modal; rejecting keeps it open and states
     * why, so a caller that wants the dialog to stay open lets the error out.
     */
    onConfirm: () => void | Promise<void>;
    onClose: () => void;
    /** Overrides the first field, for a dialog that opens somewhere other than its first input. */
    initialFocusRef?: MutableRefObject<HTMLElement | null>;
    /** Actions belonging to the form itself, placed to the left of Cancel. */
    leadingActions?: ReactNode;
    /** What to say when the work fails and the failure carries no message of its own. */
    failureFallback?: string;
    maxWidth?: string;
    fitViewport?: boolean;
};

/**
 * Where a dialog opens: the first field somebody types into.
 *
 * Not merely the first field — a select carrying the right answer already, or a
 * checkbox, comes first because the sentence reads that way, not because it is
 * what you came to change. Typing is what a dialog is opened to do, so the
 * caret goes where typing happens and the rest is reached by Tab.
 */
const TYPED_FIELDS =
    'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="range"]):not([type="color"]):not([type="submit"]):not([type="button"]), textarea, [contenteditable="true"]';

/** The fallback for a dialog that asks for a choice rather than for words. */
const ANY_FIELD = 'input:not([type="hidden"]), select, textarea, [contenteditable="true"]';

/**
 * Where a dialog opens when its first field is not where a person starts.
 *
 * A select that already carries the right answer is one such field: it comes
 * first because the sentence reads that way, not because it is what you came
 * to change. Marking the real starting point is a word in the markup, which is
 * why this is an attribute rather than a ref threaded through every dialog.
 */
const CHOSEN_FIELD = '[data-autofocus]';

export default function FormModal({
    open,
    title,
    confirmText = 'Save',
    confirmTone = 'primary',
    cancelText = 'Cancel',
    validate,
    onConfirm,
    onClose,
    initialFocusRef,
    leadingActions,
    failureFallback = 'That did not work. Try again.',
    maxWidth,
    fitViewport,
    children,
}: PropsWithChildren<FormModalProps>) {
    const formId = useId();
    const [submitted, setSubmitted] = useState(false);
    const [busy, setBusy] = useState(false);
    const [failure, setFailure] = useState<string | null>(null);
    const form = useRef<HTMLFormElement | null>(null);
    const discoveredFocus = useRef<HTMLElement | null>(null);

    /* A dialog reopened is a dialog that never failed. */
    useEffect(() => {
        if (!open) {
            return;
        }

        setSubmitted(false);
        setBusy(false);
        setFailure(null);
    }, [open]);

    /*
     * Headless UI reads this ref in a deferred callback and, finding nothing,
     * falls back to the first focusable element in the panel. It is filled in a
     * layout effect because the panel is committed by then and the deferred
     * callback runs later still. `BaseModal` keeps its close button last in the
     * DOM so that even the fallback lands on a field.
     */
    useLayoutEffect(() => {
        if (!open || initialFocusRef) {
            return;
        }

        discoveredFocus.current = form.current ? firstField(form.current) : null;
    }, [initialFocusRef, open]);

    /*
     * And if it still landed elsewhere — a dialog whose fields arrive with a
     * query, so the layout effect above ran before they existed — this puts it
     * back once the panel has settled, without stealing focus already inside.
     */
    useEffect(() => {
        if (!open || initialFocusRef) {
            return;
        }

        const settle = requestAnimationFrame(() => {
            const node = form.current;
            if (!node || node.contains(document.activeElement)) {
                return;
            }

            firstField(node)?.focus();
        });

        return () => cancelAnimationFrame(settle);
    }, [initialFocusRef, open]);

    /*
     * Enter confirms, wherever it is pressed.
     *
     * The button that submits lives in the footer, outside the form it belongs
     * to, and a browser's own implicit submission is not dependable across the
     * controls used here — a native select, a react-select, a list of
     * checkboxes. So the form says it plainly. A textarea keeps Enter for its
     * newline, and anything that already handled the key — a combobox picking
     * the highlighted option — has marked the event and is left alone.
     */
    const submitOnEnter = (event: ReactKeyboardEvent<HTMLFormElement>) => {
        if (event.key !== 'Enter' || event.defaultPrevented || event.shiftKey || busy) {
            return;
        }

        const from = event.target as HTMLElement;
        if (from instanceof HTMLTextAreaElement || from instanceof HTMLButtonElement || from instanceof HTMLAnchorElement || from.isContentEditable) {
            return;
        }

        event.preventDefault();
        void confirm();
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        void confirm();
    };

    const confirm = async () => {
        if (busy) {
            return;
        }

        setSubmitted(true);
        setFailure(null);
        if (validate && validate().length > 0) {
            return;
        }

        setBusy(true);
        try {
            await onConfirm();
            onClose();
        } catch (error) {
            setFailure(apiErrorMessage(error, failureFallback));
        } finally {
            setBusy(false);
        }
    };

    /* What is missing is said from the start; only its tone changes once it has refused a confirmation. */
    const errors = failure ? [failure] : validate ? validate() : [];

    return (
        <BaseModal
            open={open}
            onClose={busy ? noop : onClose}
            title={title}
            busy={busy}
            maxWidth={maxWidth}
            fitViewport={fitViewport}
            initialFocus={initialFocusRef ?? discoveredFocus}
            footer={
                /* A body that scrolls needs a line where the scrolling stops, and the
                   negative margins put that line against the edges of the panel. */
                <div className={`flex flex-col gap-3 ${fitViewport ? '-mx-4 -mb-4 border-t border-ui-border bg-ui-surface px-4 py-3 sm:-mx-6 sm:-mb-6 sm:px-6' : ''}`}>
                    <ModalErrors errors={errors} tone={submitted || failure ? 'asked' : 'waiting'} />
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                        {leadingActions && <div className="sm:mr-auto">{leadingActions}</div>}
                        <button type="button" onClick={onClose} disabled={busy} className={`text-sm ${btnSecondary}`}>
                            {cancelText}
                        </button>
                        <button type="submit" form={formId} disabled={busy} className={`text-sm ${confirmTone === 'danger' ? btnDanger : btnPrimary}`}>
                            {busy ? <FontAwesomeIcon icon={faCircleNotch} spin aria-label="Working" /> : confirmText}
                        </button>
                    </div>
                </div>
            }
        >
            {/* The browser's own bubbles would say the same thing in a second place, so the slot above owns it. */}
            <form id={formId} ref={form} onSubmit={submit} onKeyDown={submitOnEnter} noValidate className="flex flex-col gap-3">
                <fieldset disabled={busy} className="flex min-w-0 flex-col gap-3 border-0 p-0 disabled:opacity-60">
                    {children}
                </fieldset>
            </form>
        </BaseModal>
    );
}

function noop(): void {}

function firstField(form: HTMLElement): HTMLElement | null {
    return pick(form, CHOSEN_FIELD) ?? pick(form, TYPED_FIELDS) ?? pick(form, ANY_FIELD) ?? pick(form, 'button');
}

function pick(form: HTMLElement, selector: string): HTMLElement | null {
    return Array.from(form.querySelectorAll<HTMLElement>(selector)).find(reachable) ?? null;
}

/*
 * Read from the markup rather than from layout: a panel still playing its
 * opening transition has not been laid out yet, and asking it where things are
 * answers that nothing is anywhere.
 */
function reachable(element: HTMLElement): boolean {
    return !element.hasAttribute('disabled') && !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true' && !element.closest('[hidden]');
}
