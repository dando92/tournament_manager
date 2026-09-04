import { useMemo } from 'react';
import ReactSelect from 'react-select';
import { DROPDOWN_COMPONENTS } from '@/shared/components/ui/dropdownParts';
import { selectStyles, type SelectVariant } from '@/styles/selectStyles';

/**
 * The one dropdown.
 *
 * A single choice from a known list used to be a native `<select>`, on the
 * grounds that the platform draws it well. It draws the closed box well; the
 * list it opens is the one thing on the page no stylesheet reaches, so the same
 * screen could show a themed field, a themed panel from `MultiSelect`, and a
 * system list from the browser, side by side. Converging them was worth the one
 * thing it costs: a phone gives this a panel rather than its wheel.
 *
 * What the three placements are, and what the panel looks like, is decided once
 * in `styles/selectStyles.ts`. This file is what a call site sees: options in, a
 * value out, no event to unwrap and no number to parse back out of a string.
 */

export type { SelectVariant };

export type SelectOption<TValue extends string | number = string> = {
    value: TValue;
    label: string;
    isDisabled?: boolean;
};

/** A run of options under a heading, for a list that answers with two kinds of thing. */
export type SelectOptionGroup<TValue extends string | number = string> = {
    label: string;
    options: SelectOption<TValue>[];
};

export type SelectOptions<TValue extends string | number = string> = (SelectOption<TValue> | SelectOptionGroup<TValue>)[];

/**
 * Below this many options a search field is noise: the whole list is on the
 * screen and the arrow keys already reach it. Above it, typing is the only
 * reasonable way in - a pool holds hundreds of songs.
 */
const SEARCHABLE_FROM = 8;

function isGroup<TValue extends string | number>(entry: SelectOption<TValue> | SelectOptionGroup<TValue>): entry is SelectOptionGroup<TValue> {
    return 'options' in entry;
}

/** Every option the list holds, groups flattened, in the order they are shown. */
function flattenOptions<TValue extends string | number>(options: SelectOptions<TValue>): SelectOption<TValue>[] {
    return options.flatMap((entry) => (isGroup(entry) ? entry.options : [entry]));
}

type SelectProps<TValue extends string | number> = {
    options: SelectOptions<TValue>;
    /** The chosen value. Nothing chosen shows the placeholder. */
    value: TValue | null | undefined;
    onChange: (value: TValue) => void;
    variant?: SelectVariant;
    placeholder?: string;
    disabled?: boolean;
    /** Applied to the control's box, so width and max width belong here. */
    className?: string;
    title?: string;
    'aria-label'?: string;
    inputId?: string;
};

export default function Select<TValue extends string | number = string>({
    options,
    value,
    onChange,
    variant = 'field',
    placeholder = 'Select…',
    disabled = false,
    className,
    title,
    'aria-label': ariaLabel,
    inputId,
}: SelectProps<TValue>) {
    const styles = useMemo(() => selectStyles<SelectOption<TValue>, false, SelectOptionGroup<TValue>>(variant), [variant]);
    const flat = useMemo(() => flattenOptions(options), [options]);
    const selected = useMemo(() => flat.find((option) => option.value === value) ?? null, [flat, value]);

    /* A field fills the column it is labelled in; a toolbar control and a word
       inside the advancement sentence are sized by their own content and have to
       stay on the line they were written on. */
    const box = [variant === 'field' ? 'block' : 'inline-block align-middle', className ?? ''].filter(Boolean).join(' ');

    return (
        <span className={box} title={title}>
            <ReactSelect<SelectOption<TValue>, false, SelectOptionGroup<TValue>>
                options={options}
                value={selected}
                onChange={(option) => option && onChange(option.value)}
                isDisabled={disabled}
                isSearchable={flat.length >= SEARCHABLE_FROM}
                placeholder={placeholder}
                aria-label={ariaLabel}
                inputId={inputId}
                menuPortalTarget={document.body}
                menuPlacement="auto"
                styles={styles}
                components={DROPDOWN_COMPONENTS}
            />
        </span>
    );
}
