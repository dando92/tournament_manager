import type { StylesConfig } from "react-select";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const selectStyles: StylesConfig<any, any, any> = {
  control: (base) => ({ ...base, backgroundColor: "white", color: "black" }),
  menu: (base) => ({ ...base, backgroundColor: "white" }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isFocused ? "#f3f4f6" : "white",
    color: "black",
  }),
  singleValue: (base) => ({ ...base, color: "black" }),
  multiValue: (base) => ({ ...base, backgroundColor: "#e5e7eb" }),
  multiValueLabel: (base) => ({ ...base, color: "black" }),
  input: (base) => ({ ...base, color: "black" }),
  placeholder: (base) => ({ ...base, color: "#6b7280" }),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const selectPortalStyles: StylesConfig<any, any, any> = {
  ...selectStyles,
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
};
