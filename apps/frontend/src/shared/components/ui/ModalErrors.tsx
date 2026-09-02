/**
 * What a dialog is still waiting for, and why it refused.
 *
 * One slot, one shape, one place: between what the dialog holds and the button
 * that will not act on it, outside anything that scrolls. Every dialog draws it
 * through this, so no two of them can drift apart.
 *
 * The same list is shown from the moment the dialog opens, so nobody discovers
 * what a form wants only by failing to submit it. Until it has been submitted
 * it is written as guidance; after, in the colour of a refusal. Nothing has
 * gone wrong yet on a form nobody has filled in.
 */

type ModalErrorsProps = {
    errors: string[];
    /** `asked` once the confirmation has been attempted and refused. */
    tone: 'waiting' | 'asked';
};

export default function ModalErrors({ errors, tone }: ModalErrorsProps) {
    if (errors.length === 0) {
        return null;
    }

    const skin = tone === 'asked' ? 'border-state-failed/40 text-state-failed' : 'border-ui-border text-ui-text-mute';

    return (
        <div className={`flex flex-col gap-1 rounded border px-3 py-2 text-xs ${skin}`} role={tone === 'asked' ? 'alert' : undefined} aria-live="polite">
            {errors.map((error) => (
                <p key={error}>{error}</p>
            ))}
        </div>
    );
}
