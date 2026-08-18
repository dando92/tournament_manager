import PlayersTab from "@/features/division/components/PlayersTab";
import { useDivisionPageContext } from "@/features/division/context/DivisionPageContext";

export default function DivisionPlayersPage() {
  const { division, controls, refreshDivision } = useDivisionPageContext();
  return <PlayersTab division={division} canEdit={controls} onPlayersChanged={refreshDivision} />;
}
