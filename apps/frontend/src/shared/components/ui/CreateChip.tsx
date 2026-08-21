import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";

type CreateChipProps = {
  title: string;
  onClick: () => void;
  shape?: "pill" | "tile";
  disabled?: boolean;
};

const SHAPE_CLASSES: Record<NonNullable<CreateChipProps["shape"]>, string> = {
  pill: "rounded-full px-3 py-1",
  tile: "flex w-32 shrink-0 self-stretch items-center justify-center rounded px-3 py-1.5",
};

export default function CreateChip({ title, onClick, shape = "pill", disabled = false }: CreateChipProps) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`border border-dashed border-green-300 text-xs text-green-700 transition-colors hover:border-green-400 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50 ${SHAPE_CLASSES[shape]}`}
    >
      <FontAwesomeIcon icon={faPlus} />
    </button>
  );
}
