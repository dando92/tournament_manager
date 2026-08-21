type PathRowProps = {
  ordinalLabel: string;
  sourceMatchName: string;
  colSpan: number;
  isSelected?: boolean;
  onToggle?: () => void;
};

export default function PathRow({ ordinalLabel, sourceMatchName, colSpan, isSelected = false, onToggle }: PathRowProps) {
  const canToggle = Boolean(onToggle);

  return (
    <tr
      className={`border-t border-gray-100 transition-colors ${
        isSelected
          ? "bg-emerald-50"
          : canToggle
            ? "cursor-pointer hover:bg-gray-50"
            : ""
      }`}
      onClick={onToggle}
    >
      <td
        colSpan={colSpan}
        className={`px-3 py-2 text-center text-sm italic ${
          isSelected ? "text-emerald-700 font-medium" : "text-gray-500"
        }`}
      >
        {ordinalLabel} of {sourceMatchName}
      </td>
    </tr>
  );
}
