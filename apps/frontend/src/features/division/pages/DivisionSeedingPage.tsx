import SeedingTab from "@/features/division/components/SeedingTab";
import { useDivisionPageContext } from "@/features/division/context/DivisionPageContext";

export default function DivisionSeedingPage() {
  const { division, controls, refreshDivision } = useDivisionPageContext();
  return <SeedingTab division={division} canEdit={controls} onSeedingChanged={refreshDivision} />;
}
