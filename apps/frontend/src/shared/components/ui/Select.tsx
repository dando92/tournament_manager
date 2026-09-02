import type { ReactNode, SelectHTMLAttributes } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons';

/**
 * The one dropdown.
 *
 * A native `<select>` is the right control for a single choice from a known
 * list: the platform already draws it well, and on a phone it is a wheel rather
 * than a panel nothing here would have built. What it does not do is follow the
 * theme on its own, so every call site had restyled it - a dozen of them, each
 * with its own border, padding and arrow, one of them a literal `▼` character.
 * This is that treatment, decided once.
 *
 * Two things are deliberate. The arrow is ours, drawn beside a control set to
 * `appearance-none`, because the user agent's own arrow takes a colour we do
 * not control. And the surface belongs to the wrapper while the select inside
 * it stays transparent, which is what lets a long label truncate instead of
 * widening the box.
 *
 * The option list is not styled here and cannot be: the browser draws it
 * outside the page. It is themed once in the base layer of `index.css`.
 */

/**
 * `field` is a form control in a labelled column, `compact` a toolbar control
 * next to other small chrome, and `inline` a value inside a sentence, on the
 * raised surface the advancement editor uses for its editable words.
 */
export type SelectVariant = 'field' | 'compact' | 'inline';

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> & {
    variant?: SelectVariant;
    /** Applied to the control's box, so width and max width belong here. */
    className?: string;
    children: ReactNode;
};

/*
 * A field is block-level so it fills the column it is labelled in, the way the
 * form controls beside it do. A toolbar or sentence control is not: it sits
 * next to other words and must be sized by its own content.
 */
const WRAPPER_BASE = 'items-center gap-1.5 rounded transition-colors focus-within:ring-2 focus-within:ring-ui-accent';

const WRAPPER_VARIANTS: Record<SelectVariant, string> = {
    field: 'flex border border-ui-border-strong bg-ui-surface px-3 py-2 text-sm text-ui-text',
    compact: 'inline-flex border border-ui-border bg-ui-surface px-2 py-1 text-xs text-ui-text-soft',
    inline: 'inline-flex min-h-7 bg-ui-raised px-1.5 py-0.5 text-sm font-medium text-ui-text hover:bg-ui-selected',
};

const CONTROL = 'w-full min-w-0 cursor-pointer appearance-none truncate bg-transparent p-0 text-inherit outline-none disabled:cursor-not-allowed';

const CHEVRON_VARIANTS: Record<SelectVariant, string> = {
    field: 'shrink-0 text-xs text-ui-text-mute',
    compact: 'shrink-0 text-[10px] text-ui-text-mute',
    inline: 'shrink-0 text-[10px] text-ui-text-mute',
};

export default function Select({ variant = 'field', className, children, ...controlProps }: SelectProps) {
    const box = [WRAPPER_BASE, WRAPPER_VARIANTS[variant], controlProps.disabled ? 'opacity-50' : '', className ?? ''].filter(Boolean).join(' ');

    return (
        <span className={box}>
            <select {...controlProps} className={CONTROL}>
                {children}
            </select>
            <FontAwesomeIcon icon={faChevronDown} className={CHEVRON_VARIANTS[variant]} />
        </span>
    );
}
