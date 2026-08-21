import BracketsTab from "@/features/division/components/BracketsTab";
import { useDivisionPageContext } from "@/features/division/context/DivisionPageContext";

export default function DivisionPhasesPage() {
  const { division, tournamentId, controls, openCreatePhase, refreshDivision } = useDivisionPageContext();

  return (
    <BracketsTab
      division={division}
      controls={controls}
      tournamentId={tournamentId}
      onCreatePhase={openCreatePhase}
      onDivisionChanged={refreshDivision}
    />
  );
}
