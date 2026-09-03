import { useEffect, useState } from "react";
import FormModal from "@/shared/components/ui/FormModal";
import Select from "@/shared/components/ui/Select";
import { TournamentDivisionOption } from "@/features/tournament/model/types";
import { GenerateBracketRequest } from "@/features/division/model/types";
import { readBracketType, writeBracketType } from "@/shared/lib/bracketPreferences";

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
  const [bracketType, setBracketType] = useState(() => readBracketType(bracketTypes));
  const [playerPerMatch, setPlayerPerMatch] = useState(2);

  useEffect(() => {
    if (!open) return;
    const nextDivisionId = currentDivisionId ?? divisions[0]?.id ?? 0;
    setDivisionId(nextDivisionId);
    setPhaseName("");
    /* The destination is where the dialog was opened from, so it is read again;
       the kind of bracket is a habit, so it opens on the last one chosen. */
    setBracketType(readBracketType(bracketTypes));
    setPlayerPerMatch(2);
  }, [bracketTypes, currentDivisionId, divisions, open]);

  const validate = () => {
    const errors: string[] = [];
    if (!divisionId) {
      errors.push("Choose the division the bracket belongs to.");
    }
    if (!bracketType) {
      errors.push("Choose a bracket type.");
    }
    if (playerPerMatch < 2) {
      errors.push("A match holds at least two players.");
    }

    return errors;
  };

  const handleGenerate = () =>
    onGenerate({
      divisionId,
      phaseId: currentPhaseId,
      phaseName: currentPhaseId ? undefined : phaseName.trim() || undefined,
      bracketType,
      playerPerMatch,
    });

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title="Generate bracket"
      confirmText="Generate"
      validate={validate}
      onConfirm={handleGenerate}
      failureFallback="The bracket could not be generated."
      maxWidth="max-w-md"
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
              data-autofocus
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
            onChange={(event) => {
              setBracketType(event.target.value);
              writeBracketType(event.target.value);
            }}
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
    </FormModal>
  );
}
