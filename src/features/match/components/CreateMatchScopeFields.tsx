import Select from "react-select";
import { selectPortalStyles } from "@/styles/selectStyles";
import { MatchPhaseOption } from "@/features/match/types/MatchPhaseOption";
import { TournamentDivisionOption } from "@/features/tournament/types/TournamentDivisionOption";

type CreateMatchScopeFieldsProps = {
  divisionId?: number;
  phaseId?: number;
  divisions?: TournamentDivisionOption[];
  phases?: MatchPhaseOption[];
  availablePhases: MatchPhaseOption[];
  availablePhaseGroups: Array<{ id: number; name: string }>;
  selectedDivisionId: number | null;
  selectedPhaseId: number | null;
  selectedPhaseGroupId: number | null;
  onDivisionChange: (divisionId: number | null) => void;
  onPhaseChange: (phaseId: number | null) => void;
  onPhaseGroupChange: (phaseGroupId: number | null) => void;
};

export default function CreateMatchScopeFields({
  divisionId,
  phaseId,
  divisions,
  phases,
  availablePhases,
  availablePhaseGroups,
  selectedDivisionId,
  selectedPhaseId,
  selectedPhaseGroupId,
  onDivisionChange,
  onPhaseChange,
  onPhaseGroupChange,
}: CreateMatchScopeFieldsProps) {
  return (
    <>
      {!divisionId && divisions && divisions.length > 0 && (
        <div className="w-full">
          <h3>Division</h3>
          <Select
            options={divisions.map((division) => ({ value: division.id, label: division.name }))}
            value={
              selectedDivisionId
                ? {
                    value: selectedDivisionId,
                    label: divisions.find((division) => division.id === selectedDivisionId)?.name ?? "",
                  }
                : null
            }
            onChange={(selected) => onDivisionChange(selected?.value ?? null)}
            menuPortalTarget={document.body}
            styles={selectPortalStyles}
          />
        </div>
      )}
      {!phaseId && phases && phases.length > 0 && (
        <div className="w-full">
          <h3>Phase</h3>
          <Select
            options={phases.map((phase) => ({ value: phase.id, label: phase.name }))}
            value={
              selectedPhaseId
                ? { value: selectedPhaseId, label: phases.find((phase) => phase.id === selectedPhaseId)?.name ?? "" }
                : null
            }
            onChange={(selected) => onPhaseChange(selected?.value ?? null)}
            menuPortalTarget={document.body}
            styles={selectPortalStyles}
          />
        </div>
      )}
      {!phaseId && !divisionId && availablePhases.length > 0 && (
        <div className="w-full">
          <h3>Phase</h3>
          <Select
            options={availablePhases.map((phase) => ({ value: phase.id, label: phase.name }))}
            value={
              selectedPhaseId
                ? {
                    value: selectedPhaseId,
                    label: availablePhases.find((phase) => phase.id === selectedPhaseId)?.name ?? "",
                  }
                : null
            }
            onChange={(selected) => onPhaseChange(selected?.value ?? null)}
            menuPortalTarget={document.body}
            styles={selectPortalStyles}
          />
        </div>
      )}
      {availablePhaseGroups.length > 0 && (
        <div className="w-full">
          <h3>Phase group</h3>
          <Select
            options={availablePhaseGroups.map((group) => ({ value: group.id, label: group.name }))}
            value={
              selectedPhaseGroupId
                ? {
                    value: selectedPhaseGroupId,
                    label: availablePhaseGroups.find((group) => group.id === selectedPhaseGroupId)?.name ?? "",
                  }
                : null
            }
            onChange={(selected) => onPhaseGroupChange(selected?.value ?? null)}
            menuPortalTarget={document.body}
            styles={selectPortalStyles}
          />
        </div>
      )}
    </>
  );
}
