import { useState } from "react";
import { btnPrimary, btnSecondary } from "@/styles/buttonStyles";
import BaseModal from "@/shared/components/ui/BaseModal";

type Props = {
  open: boolean;
  onImport: (names: string[]) => Promise<void>;
  onClose: () => void;
};

export default function BulkImportModal({ open, onImport, onClose }: Props) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);

  async function handleImport() {
    const names = text
      .split("\n")
      .map((n) => n.trim())
      .filter((n) => n.length > 0);
    if (names.length === 0) return;
    setLoading(true);
    setWarnings([]);
    try {
      await onImport(names);
      setText("");
      onClose();
    } catch {
      // handled by axios interceptor
    } finally {
      setLoading(false);
    }
  }

  const footer = (
    <div className="flex justify-end gap-2">
      <button onClick={onClose} className={`${btnSecondary} text-sm`}>
        Cancel
      </button>
      <button
        onClick={handleImport}
        disabled={loading || !text.trim()}
        className={`${btnPrimary} text-sm`}
      >
        {loading ? "Importing..." : "Import"}
      </button>
    </div>
  );

  return (
    <BaseModal open={open} onClose={onClose} title="Bulk import players" maxWidth="max-w-md" footer={footer}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-500">
          Enter one player name per line. Existing players will be linked; new ones will be created.
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"Alice\nBob\nCharlie"}
          rows={8}
          autoFocus
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-dark focus:border-transparent resize-none"
        />

        {warnings.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-300 rounded px-3 py-2 text-sm text-yellow-800">
            Already existed and linked: <span className="font-semibold">{warnings.join(", ")}</span>
          </div>
        )}
      </div>
    </BaseModal>
  );
}
