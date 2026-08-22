import PlayersTab from "@/features/division/ui/PlayersTab";
import { useDivisionPageContext } from "@/features/division/model/DivisionPageContext";

export default function DivisionPlayersPage() {
  const { division, controls, refreshDivision } = useDivisionPageContext();
  return <PlayersTab division={division} canEdit={controls} onPlayersChanged={refreshDivision} />;
}
