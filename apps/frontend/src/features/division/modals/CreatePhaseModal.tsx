import { useState, useEffect } from "react";
import OkModal from "@/shared/components/ui/OkModal";

type DivisionOption = {
  id: number;
  name: string;
};

type CreatePhaseModalProps = {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, divisionId: number) => void;
  divisions?: DivisionOption[];
  divisionId?: number;
};

export default function CreatePhaseModal({ open, onClose, onCreate, divisions, divisionId }: CreatePhaseModalProps) {
  const [name, setName] = useState("");
  const [selectedDivisionId, setSelectedDivisionId] = useState<number>(divisionId ?? divisions?.[0]?.id ?? 0);

  useEffect(() => {
    if (!open) return;
    setName("");
    setSelectedDivisionId(divisionId ?? divisions?.[0]?.id ?? 0);
  }, [divisionId, divisions, open]);

  const onSubmit = () => {
    const resolvedDivisionId = divisionId ?? selectedDivisionId;
    if (!name.trim() || !resolvedDivisionId) return;
    onCreate(name.trim(), resolvedDivisionId);
    onClose();
  };

  return (
    <OkModal
      title="Create Phase"
      okText="Create phase"
      open={open}
      onClose={onClose}
      onOk={onSubmit}
    >
      <div className="flex flex-col gap-4 w-full">
        {divisions && divisions.length > 0 && (
          <div>
            <h3 className="mb-1">Division</h3>
            <select
              className="w-full border border-gray-300 px-2 py-2 rounded-lg"
              value={selectedDivisionId}
              onChange={(e) => setSelectedDivisionId(Number(e.target.value))}
            >
              {divisions.map((division) => (
                <option key={division.id} value={division.id}>
                  {division.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <h3 className="mb-1">Name</h3>
          <input
            className="w-full border border-gray-300 px-2 py-2 rounded-lg"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Phase name"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") onSubmit(); }}
          />
        </div>
      </div>
    </OkModal>
  );
}
