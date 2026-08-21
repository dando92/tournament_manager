import type { StylesConfig } from "react-select";

/**
 * react-select cannot take Tailwind classes, but it does take any CSS value, so
 * the tokens are referenced rather than copied. That keeps the control on the
 * design system and lets it follow the theme without any work here.
 */
const SURFACE = "rgb(var(--ui-surface))";
const RAISED = "rgb(var(--ui-raised))";
const SELECTED = "rgb(var(--ui-selected))";
const BORDER = "rgb(var(--ui-border-strong))";
const TEXT = "rgb(var(--ui-text))";
const TEXT_MUTE = "rgb(var(--ui-text-mute))";
const FOCUS = "rgb(var(--state-running))";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const selectStyles: StylesConfig<any, any, any> = {
  control: (base, state) => ({
    ...base,
    backgroundColor: SURFACE,
    color: TEXT,
    borderColor: state.isFocused ? FOCUS : BORDER,
    boxShadow: state.isFocused ? `0 0 0 1px ${FOCUS}` : base.boxShadow,
    "&:hover": { borderColor: state.isFocused ? FOCUS : TEXT_MUTE },
  }),
  menu: (base) => ({ ...base, backgroundColor: SURFACE, border: `1px solid ${BORDER}` }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isFocused ? RAISED : SURFACE,
    color: TEXT,
  }),
  singleValue: (base) => ({ ...base, color: TEXT }),
  multiValue: (base) => ({ ...base, backgroundColor: SELECTED }),
  multiValueLabel: (base) => ({ ...base, color: TEXT }),
  input: (base) => ({ ...base, color: TEXT }),
  placeholder: (base) => ({ ...base, color: TEXT_MUTE }),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const selectPortalStyles: StylesConfig<any, any, any> = {
  ...selectStyles,
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
};
