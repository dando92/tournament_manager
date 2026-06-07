import { useEffect, useState } from "react";
import Select from "react-select";
import OkModal from "@/shared/components/ui/OkModal";
import { selectPortalStyles } from "@/styles/selectStyles";

type PhaseOption = {
  id: number;
  name: string;
};

type CreatePhaseGroupModalProps = {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, phaseId: number) => void;
  phases: PhaseOption[];
  phaseId?: number;
};

export default function CreatePhaseGroupModal({
  open,
  onClose,
  onCreate,
  phases,
  phaseId,
}: CreatePhaseGroupModalProps) {
  const [name, setName] = useState("");
  const [selectedPhaseId, setSelectedPhaseId] = useState<number>(phaseId ?? phases[0]?.id ?? 0);

  useEffect(() => {
    if (!open) return;
    setName("");
    setSelectedPhaseId(phaseId && phases.some((phase) => phase.id === phaseId) ? phaseId : phases[0]?.id ?? 0);
  }, [open, phaseId, phases]);

  const onSubmit = () => {
    if (!name.trim() || !selectedPhaseId) return;
    onCreate(name.trim(), selectedPhaseId);
    onClose();
  };

  return (
    <OkModal
      title="Create Phase Group"
      okText="Create phase group"
      open={open}
      onClose={onClose}
      onOk={onSubmit}
    >
      <div className="flex flex-col gap-4 w-full">
        <div>
          <h3 className="mb-1">Phase</h3>
          <Select
            options={phases.map((phase) => ({ value: phase.id, label: phase.name }))}
            value={
              selectedPhaseId
                ? {
                    value: selectedPhaseId,
                    label: phases.find((phase) => phase.id === selectedPhaseId)?.name ?? "",
                  }
                : null
            }
            onChange={(selected) => setSelectedPhaseId(selected?.value ?? 0)}
            menuPortalTarget={document.body}
            styles={selectPortalStyles}
          />
        </div>
        <div>
          <h3 className="mb-1">Name</h3>
          <input
            className="w-full border border-gray-300 px-2 py-2 rounded-lg"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Phase group name"
            autoFocus
            onKeyDown={(event) => {
              if (event.key === "Enter") onSubmit();
            }}
          />
        </div>
      </div>
    </OkModal>
  );
}
