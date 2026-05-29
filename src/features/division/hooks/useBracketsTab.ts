import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import { Division } from "@/features/division/types/Division";

type UseBracketsTabOptions = {
  division: Division;
  onDivisionChanged?: () => Promise<void>;
};

export function useBracketsTab({ division, onDivisionChanged }: UseBracketsTabOptions) {
  const navigate = useNavigate();
  const { tournamentId, divisionId, phaseId } = useParams<{
    tournamentId: string;
    divisionId: string;
    phaseId?: string;
  }>();
  const routePhaseId = Number(phaseId ?? "0");
  const phases = useMemo(() => division.phases ?? [], [division.phases]);
  const [selectedPhaseId, setSelectedPhaseIdState] = useState<number | "all">(
    routePhaseId > 0 && phases.some((phase) => phase.id === routePhaseId) ? routePhaseId : "all",
  );
  const selectedPhase =
    typeof selectedPhaseId === "number" ? phases.find((phase) => phase.id === selectedPhaseId) ?? null : null;

  useEffect(() => {
    setSelectedPhaseIdState(
      routePhaseId > 0 && phases.some((phase) => phase.id === routePhaseId) ? routePhaseId : "all",
    );
  }, [phases, routePhaseId]);

  const setSelectedPhaseId = (phaseId: number | "all") => {
    navigate(
      phaseId === "all"
        ? `/tournament/${tournamentId}/division/${divisionId}/phases`
        : `/tournament/${tournamentId}/division/${divisionId}/phases/${phaseId}`,
    );
    setSelectedPhaseIdState(phaseId);
  };

  const handleDeletePhase = async (phaseId: number) => {
    await axios.delete(`phases/${phaseId}`);
    setSelectedPhaseId("all");
    await onDivisionChanged?.();
  };

  return {
    phases,
    selectedPhaseId,
    selectedPhase,
    setSelectedPhaseId,
    handleDeletePhase,
  };
}
