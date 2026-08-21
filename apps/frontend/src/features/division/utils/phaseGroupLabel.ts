import { PhaseGroup } from "@/features/division/types/Phase";

export function phaseGroupLabel(phaseGroup: PhaseGroup): string {
  return phaseGroup.displayIdentifier?.trim() || phaseGroup.name;
}
