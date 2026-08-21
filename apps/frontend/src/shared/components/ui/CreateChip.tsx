import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";

type CreateChipProps = {
  title: string;
  onClick: () => void;
  disabled?: boolean;
};

export default function CreateChip({ title, onClick, disabled = false }: CreateChipProps) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="rounded-full border border-dashed border-green-300 px-3 py-1 text-xs text-green-700 transition-colors hover:border-green-400 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <FontAwesomeIcon icon={faPlus} />
    </button>
  );
}
