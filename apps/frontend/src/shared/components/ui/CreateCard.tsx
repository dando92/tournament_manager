import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";

type CreateCardProps = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
};

export default function CreateCard({ label, onClick, disabled = false, className = "" }: CreateCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-green-300 py-6 text-green-700 transition-colors hover:border-green-400 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      <FontAwesomeIcon icon={faPlus} className="text-lg" />
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}
