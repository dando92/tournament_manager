import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { btnCreate } from "@/styles/buttonStyles";
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
      className={`rounded-full border px-3 py-1 text-xs ${btnCreate}`}
    >
      <FontAwesomeIcon icon={faPlus} />
    </button>
  );
}
