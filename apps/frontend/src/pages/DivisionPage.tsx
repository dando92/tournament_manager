import { Navigate, useParams } from "react-router-dom";
import { usePermissions } from "@/shared/services/permissions/PermissionContext";
import DivisionLayout from "@/features/division/layout/DivisionLayout";
import { DivisionPageContextValue } from "@/features/division/context/DivisionPageContext";
import { useDivisionPage } from "@/features/division/hooks/useDivisionPage";

export default function DivisionPage() {
  const { tournamentId: tidParam, divisionId: didParam } = useParams<{ tournamentId: string; divisionId: string }>();
  const tournamentId = Number(tidParam);
  const divisionId = Number(didParam);

  if (!Number.isFinite(tournamentId) || !Number.isFinite(divisionId)) {
    return <Navigate to="/" replace />;
  }

  return <DivisionPageContainer tournamentId={tournamentId} divisionId={divisionId} />;
}

function DivisionPageContainer({ tournamentId, divisionId }: { tournamentId: number; divisionId: number }) {
  const { canEditTournament } = usePermissions();
  const canControl = canEditTournament(tournamentId);
  const { division, refreshDivision } = useDivisionPage(tournamentId, divisionId);

  if (!division) return null;

  const context: DivisionPageContextValue = {
    division,
    tournamentId,
    divisionId,
    controls: canControl,
    refreshDivision,
  };

  return <DivisionLayout context={context} />;
}
