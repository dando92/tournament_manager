import Select from "react-select";
import { selectPortalStyles } from "@/styles/selectStyles";

export type MultiSelectOption<TValue extends string | number = number> = {
  value: TValue;
  label: string;
};

type MultiSelectProps<TValue extends string | number = number> = {
  options: MultiSelectOption<TValue>[];
  value: MultiSelectOption<TValue>[];
  onChange: (selectedOptions: MultiSelectOption<TValue>[]) => void;
  placeholder?: string;
  className?: string;
};

export default function MultiSelect<TValue extends string | number = number>({
  options,
  value,
  onChange,
  placeholder,
  className,
}: MultiSelectProps<TValue>) {
  return (
    <Select<MultiSelectOption<TValue>, true>
      isMulti
      options={options}
      value={value}
      onChange={(selected) => onChange(Array.from(selected))}
      placeholder={placeholder}
      className={className}
      menuPortalTarget={document.body}
      styles={selectPortalStyles}
    />
  );
}
