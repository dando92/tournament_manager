import SeedingTab from "@/features/division/ui/SeedingTab";
import { useDivisionPageContext } from "@/features/division/model/DivisionPageContext";

export default function DivisionSeedingPage() {
  const { division, controls, refreshDivision } = useDivisionPageContext();
  return <SeedingTab division={division} canEdit={controls} onSeedingChanged={refreshDivision} />;
}
