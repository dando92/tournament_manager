import { useEffect, useState } from "react";
import BaseModal from "@/shared/components/ui/BaseModal";
import Select from "@/shared/components/ui/Select";
import { btnPrimary, btnSecondary } from "@/styles/buttonStyles";
import { TournamentDivisionOption } from "@/features/tournament/model/types";
import { GenerateBracketRequest } from "@/features/division/model/types";

type Props = {
  open: boolean;
  divisions: TournamentDivisionOption[];
  currentDivisionId?: number;
  /** The phase to build in, when the bracket was asked for from one. */
  currentPhaseId?: number;
  currentPhaseName?: string;
  bracketTypes: string[];
  onClose: () => void;
  onGenerate: (request: GenerateBracketRequest) => Promise<void>;
};

/**
 * Generating a bracket, either into a phase or into one it brings with it.
 *
 * Asked for from a phase, the destination is settled and the dialog says so
 * rather than offering a division and a phase name that would be ignored. The
 * bracket then lands in that phase's own pool while it is still empty, so the
 * usual case adds no node anybody has to read.
 */
export default function GenerateBracketModal({
  open,
  divisions,
  currentDivisionId,
  currentPhaseId,
  currentPhaseName,
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
        phaseId: currentPhaseId,
        phaseName: currentPhaseId ? undefined : phaseName.trim() || undefined,
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
        {currentPhaseId ? (
          <p className="text-sm text-ui-text-mute">
            The bracket is built in <span className="font-semibold text-ui-text">{currentPhaseName}</span>.
          </p>
        ) : null}
        {!currentDivisionId && !currentPhaseId && (
          <div>
            <label className="block text-sm font-medium mb-1">Division</label>
            <Select
              value={divisionId}
              onChange={(event) => setDivisionId(Number(event.target.value))}
            >
              {divisions.map((division) => (
                <option key={division.id} value={division.id}>
                  {division.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        {!currentPhaseId && (
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
        )}
        <div>
          <label className="block text-sm font-medium mb-1">Bracket type</label>
          <Select
            value={bracketType}
            onChange={(event) => setBracketType(event.target.value)}
          >
            {bracketTypes.map((candidate) => (
              <option key={candidate} value={candidate}>
                {candidate === "Manual" ? "First phase only" : candidate}
              </option>
            ))}
          </Select>
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
