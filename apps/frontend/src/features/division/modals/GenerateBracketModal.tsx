import { useEffect, useState } from "react";
import BaseModal from "@/shared/components/ui/BaseModal";
import { btnPrimary, btnSecondary } from "@/styles/buttonStyles";
import { TournamentDivisionOption } from "@/features/tournament/types/TournamentDivisionOption";
import { GenerateBracketRequest } from "@/features/tournament/hooks/useTournamentPage";

type Props = {
  open: boolean;
  divisions: TournamentDivisionOption[];
  currentDivisionId?: number;
  bracketTypes: string[];
  onClose: () => void;
  onGenerate: (request: GenerateBracketRequest) => Promise<void>;
};

export default function GenerateBracketModal({
  open,
  divisions,
  currentDivisionId,
  bracketTypes,
  onClose,
  onGenerate,
}: Props) {
  const initialDivisionId = currentDivisionId ?? divisions[0]?.id ?? 0;
  const [divisionId, setDivisionId] = useState(initialDivisionId);
  const [phaseName, setPhaseName] = useState("");
  const [bracketType, setBracketType] = useState(bracketTypes[0] ?? "");
  const [playerPerMatch, setPlayerPerMatch] = useState(2);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!open) return;
    const nextDivisionId = currentDivisionId ?? divisions[0]?.id ?? 0;
    setDivisionId(nextDivisionId);
    setPhaseName("");
    setBracketType(bracketTypes[0] ?? "");
    setPlayerPerMatch(2);
  }, [bracketTypes, currentDivisionId, divisions, open]);

  const handleGenerate = async () => {
    if (!divisionId || !bracketType) return;
    setGenerating(true);
    try {
      await onGenerate({
        divisionId,
        phaseName: phaseName.trim() || undefined,
        bracketType,
        playerPerMatch,
      });
      onClose();
    } finally {
      setGenerating(false);
    }
  };

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      title="Generate bracket"
      maxWidth="max-w-md"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={`${btnSecondary} text-sm`}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !divisionId || !bracketType}
            className={`${btnPrimary} text-sm disabled:cursor-not-allowed`}
          >
            {generating ? "Generating..." : "Generate"}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {!currentDivisionId && (
          <div>
            <label className="block text-sm font-medium mb-1">Division</label>
            <select
              className="border rounded px-2 py-2 text-sm w-full"
              value={divisionId}
              onChange={(event) => setDivisionId(Number(event.target.value))}
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
          <label className="block text-sm font-medium mb-1">Phase name</label>
          <input
            type="text"
            value={phaseName}
            onChange={(event) => setPhaseName(event.target.value)}
            placeholder="Bracket"
            className="border rounded px-2 py-2 text-sm w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Bracket type</label>
          <select
            className="border rounded px-2 py-2 text-sm w-full"
            value={bracketType}
            onChange={(event) => setBracketType(event.target.value)}
          >
            {bracketTypes.map((candidate) => (
              <option key={candidate} value={candidate}>
                {candidate === "Manual" ? "First phase only" : candidate}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Players per match</label>
          <input
            type="number"
            min={2}
            value={playerPerMatch}
            onChange={(event) => setPlayerPerMatch(Number(event.target.value))}
            className="border rounded px-2 py-2 text-sm w-full"
          />
        </div>
      </div>
    </BaseModal>
  );
}
