import type { StylesConfig } from "react-select";

/**
 * react-select cannot take Tailwind classes, so the design tokens it needs are
 * repeated here as literals. Keep them in step with tailwind.config.js.
 */
const GRAY_100 = "#F3F4F6";
const GRAY_200 = "#E5E7EB";
const GRAY_300 = "#D1D5DB";
const GRAY_500 = "#6B7280";
const GRAY_800 = "#1F2937";
const BRAND_600 = "#1571B7";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const selectStyles: StylesConfig<any, any, any> = {
  control: (base, state) => ({
    ...base,
    backgroundColor: "white",
    color: GRAY_800,
    borderColor: state.isFocused ? BRAND_600 : GRAY_300,
    boxShadow: state.isFocused ? `0 0 0 1px ${BRAND_600}` : base.boxShadow,
    "&:hover": { borderColor: state.isFocused ? BRAND_600 : GRAY_500 },
  }),
  menu: (base) => ({ ...base, backgroundColor: "white" }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isFocused ? GRAY_100 : "white",
    color: GRAY_800,
  }),
  singleValue: (base) => ({ ...base, color: GRAY_800 }),
  multiValue: (base) => ({ ...base, backgroundColor: GRAY_200 }),
  multiValueLabel: (base) => ({ ...base, color: GRAY_800 }),
  input: (base) => ({ ...base, color: GRAY_800 }),
  placeholder: (base) => ({ ...base, color: GRAY_500 }),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const selectPortalStyles: StylesConfig<any, any, any> = {
  ...selectStyles,
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
};
