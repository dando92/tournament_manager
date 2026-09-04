import { components, type DropdownIndicatorProps, type GroupBase, type OptionProps } from 'react-select';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faChevronDown } from '@fortawesome/free-solid-svg-icons';

/**
 * The two pieces of the dropdown that are drawn rather than styled.
 *
 * They live beside the control instead of inside it so the single-choice and
 * the several-choices faces of it share one arrow and one option row, and so
 * neither face has to define its own.
 *
 * The two are module-private and only the pairing is exported, which is what the
 * fast-refresh rule is being told to allow: this file is a part of a control
 * rather than a screen, so there is nothing here to reload on its own.
 */
/* eslint-disable react-refresh/only-export-components */

/* The arrow is ours for the reason it always was: the user agent's own takes a
   colour we do not control. */
function DropdownChevron<TOption, TMulti extends boolean, TGroup extends GroupBase<TOption>>(props: DropdownIndicatorProps<TOption, TMulti, TGroup>) {
    return (
        <components.DropdownIndicator {...props}>
            <FontAwesomeIcon icon={faChevronDown} className="text-xs" />
        </components.DropdownIndicator>
    );
}

/* A chosen option keeps its place in the list and says so with a check, rather
   than disappearing from it. A list that reorders itself as you pick from it is
   what makes choosing several of anything tiring. */
function OptionRow<TOption, TMulti extends boolean, TGroup extends GroupBase<TOption>>(props: OptionProps<TOption, TMulti, TGroup>) {
    return (
        <components.Option {...props}>
            <span className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate">{props.children}</span>
                {props.isSelected && <FontAwesomeIcon icon={faCheck} className="shrink-0 text-xs text-ui-accent" />}
            </span>
        </components.Option>
    );
}

export const DROPDOWN_COMPONENTS = { DropdownIndicator: DropdownChevron, Option: OptionRow };
