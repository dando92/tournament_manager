import { useState, useEffect } from "react";
import OkModal from "@/shared/components/ui/OkModal";

type CreateDivisionModalProps = {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
};

export default function CreateDivisionModal({
  open,
  onClose,
  onCreate,
}: CreateDivisionModalProps) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (!open) return;
    setName("");
  }, [open]);

  const onSubmit = () => {
    if (!name.trim()) return;
    onCreate(name.trim());
    onClose();
  };

  return (
    <OkModal
      title="Create Division"
      okText="Create division"
      open={open}
      onClose={onClose}
      onOk={onSubmit}
    >
      <div className="flex flex-col gap-4 w-full">
        <div>
          <h3 className="mb-1">Name</h3>
          <input
            className="w-full border border-gray-300 px-2 py-2 rounded-lg"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Division name"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") onSubmit(); }}
          />
        </div>
      </div>
    </OkModal>
  );
}
