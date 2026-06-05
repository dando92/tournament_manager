import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { Tournament } from "@/features/tournament/types/Tournament";
import { addRecentTournament } from "@/features/tournament/services/recentTournaments";
import { useTournamentUpdates } from "@/features/tournament/context/TournamentUpdatesContext";
import { TournamentOverview } from "@/features/tournament/types/TournamentOverview";
import { TournamentDivisionOption } from "@/features/tournament/types/TournamentDivisionOption";
import { Division } from "@/features/division/types/Division";
import { Phase } from "@/features/division/types/Phase";
import { createPhaseGroup } from "@/features/division/services/phase-groups.api";

type UseTournamentPageOptions = {
  tournamentId: number;
  canControl: boolean;
};

export type GenerateBracketRequest = {
  divisionId: number;
  phaseName?: string;
  bracketType: string;
  playerPerMatch: number;
};

export type GenerateBracketResult = {
  divisionId: number;
  phaseId: number;
  phaseGroupId: number;
};

export type TournamentPageState = {
  divisions: TournamentDivisionOption[];
  tournamentName: string;
  syncstartUrl: string;
  createDivisionOpen: boolean;
  createPhaseOpen: boolean;
  createPhaseGroupOpen: boolean;
  generateBracketOpen: boolean;
  createMenuOpen: boolean;
  bracketTypes: string[];
  setCreateDivisionOpen: Dispatch<SetStateAction<boolean>>;
  setCreatePhaseOpen: Dispatch<SetStateAction<boolean>>;
  setCreatePhaseGroupOpen: Dispatch<SetStateAction<boolean>>;
  setGenerateBracketOpen: Dispatch<SetStateAction<boolean>>;
  setCreateMenuOpen: Dispatch<SetStateAction<boolean>>;
  setSyncstartUrl: Dispatch<SetStateAction<string>>;
  refreshDivisions: () => Promise<void>;
  handleCreateDivision: (name: string, playersPerMatch: number | null) => void;
  handleCreatePhase: (name: string, divisionId: number) => Promise<void>;
  handleCreatePhaseGroup: (name: string, phaseId: number) => Promise<{ divisionId: number; phaseId: number }>;
  handleGenerateBracket: (request: GenerateBracketRequest) => Promise<GenerateBracketResult>;
};

export function useTournamentPage({
  tournamentId,
  canControl,
}: UseTournamentPageOptions): TournamentPageState {
  const { tournamentVersion, divisionDetailVersions, matchListVersions } = useTournamentUpdates();
  const [divisions, setDivisions] = useState<TournamentDivisionOption[]>([]);
  const [tournamentName, setTournamentName] = useState("");
  const [syncstartUrl, setSyncstartUrl] = useState("");
  const [createDivisionOpen, setCreateDivisionOpen] = useState(false);
  const [createPhaseOpen, setCreatePhaseOpen] = useState(false);
  const [createPhaseGroupOpen, setCreatePhaseGroupOpen] = useState(false);
  const [generateBracketOpen, setGenerateBracketOpen] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [bracketTypes, setBracketTypes] = useState<string[]>([]);
  const previousDivisionDetailVersions = useRef<ReadonlyMap<number, number>>(new Map());
  const previousMatchListVersions = useRef<ReadonlyMap<number, number>>(new Map());

  const toDivisionOption = useCallback((division: Division): TournamentDivisionOption => ({
    id: division.id,
    name: division.name,
    playersPerMatch: division.playersPerMatch ?? null,
    entrants: division.entrants ?? [],
    phases: (division.phases ?? []).map((phase) => ({
      id: phase.id,
      name: phase.name,
      matchCount: phase.matchCount ?? 0,
      phaseGroups: phase.phaseGroups ?? [],
    })),
  }), []);

  const mergeDivisionOption = useCallback((nextDivision: TournamentDivisionOption) => {
    setDivisions((prev) => {
      const index = prev.findIndex((division) => division.id === nextDivision.id);
      if (index === -1) {
        return [...prev, nextDivision];
      }

      const next = [...prev];
      next[index] = nextDivision;
      return next;
    });
  }, []);

  const refreshDivisions = useCallback(async () => {
    const response = await axios.get<TournamentOverview>(`tournaments/${tournamentId}/overview`);
    setDivisions(
      response.data.divisions.map((division) => ({
        id: division.id,
        name: division.name,
        playersPerMatch: division.playersPerMatch ?? null,
        entrants: division.entrants,
        phases: division.phases.map((phase) => ({
          id: phase.id,
          name: phase.name,
          matchCount: phase.matchCount,
          phaseGroups: phase.phaseGroups ?? [],
        })),
      })),
    );
  }, [tournamentId]);

  const refreshDivision = useCallback(async (divisionId: number) => {
    const response = await axios.get<Division>(`divisions/${divisionId}`);
    mergeDivisionOption(toDivisionOption(response.data));
  }, [mergeDivisionOption, toDivisionOption]);

  useEffect(() => {
    axios
      .get<Tournament>(`tournaments/${tournamentId}`)
      .then((r) => {
        addRecentTournament({ id: r.data.id, name: r.data.name });
        setTournamentName(r.data.name);
        setSyncstartUrl(r.data.syncstartUrl ?? "");
        document.title = `${r.data.name} - Tournament Manager`;
      })
      .catch(() => {});

    refreshDivisions().catch(() => {});
    return () => {
      document.title = "Tournament Manager";
    };
  }, [refreshDivisions, tournamentId]);

  useEffect(() => {
    if (tournamentVersion === 0) return;
    refreshDivisions().catch(() => {});
  }, [refreshDivisions, tournamentVersion]);

  useEffect(() => {
    if (!canControl) return;
    axios.get<string[]>("bracket/bracket-types")
      .then((response) => setBracketTypes(response.data))
      .catch(() => {});
  }, [canControl]);

  useEffect(() => {
    const changedDivisionIds = new Set<number>();

    for (const [divisionId, version] of divisionDetailVersions.entries()) {
      if ((previousDivisionDetailVersions.current.get(divisionId) ?? 0) !== version) {
        changedDivisionIds.add(divisionId);
      }
    }

    for (const [divisionId, version] of matchListVersions.entries()) {
      if ((previousMatchListVersions.current.get(divisionId) ?? 0) !== version) {
        changedDivisionIds.add(divisionId);
      }
    }

    previousDivisionDetailVersions.current = new Map(divisionDetailVersions);
    previousMatchListVersions.current = new Map(matchListVersions);

    if (changedDivisionIds.size === 0) return;

    changedDivisionIds.forEach((divisionId) => {
      refreshDivision(divisionId).catch(() => {});
    });
  }, [divisionDetailVersions, matchListVersions, refreshDivision]);

  const handleCreateDivision = useCallback((name: string, playersPerMatch: number | null) => {
    axios.post<{ id: number; name: string; playersPerMatch: number | null }>("divisions", {
      tournamentId,
      name,
      playersPerMatch,
    })
      .then((r) => {
        setDivisions((prev) => [
          ...prev,
          {
            id: r.data.id,
            name: r.data.name,
            playersPerMatch: r.data.playersPerMatch ?? null,
            entrants: [],
            phases: [],
          },
        ]);
      })
      .catch(() => {});
  }, [tournamentId]);

  const handleCreatePhase = useCallback(async (name: string, divisionId: number) => {
    const response = await axios.post<Phase>("phases", { name, divisionId });
    setDivisions((prev) =>
      prev.map((division) =>
        division.id === divisionId
          ? {
              ...division,
              phases: [...division.phases, {
                id: response.data.id,
                name: response.data.name,
                matchCount: 0,
                phaseGroups: response.data.phaseGroups ?? [],
              }],
            }
          : division,
      ),
    );
  }, []);

  const handleCreatePhaseGroup = useCallback(async (name: string, phaseId: number) => {
    const phaseDivision = divisions.find((division) => division.phases.some((phase) => phase.id === phaseId));
    await createPhaseGroup(phaseId, { name });
    if (phaseDivision) {
      await refreshDivision(phaseDivision.id);
    }
    return {
      divisionId: phaseDivision?.id ?? 0,
      phaseId,
    };
  }, [divisions, refreshDivision]);

  const handleGenerateBracket = useCallback(async (request: GenerateBracketRequest): Promise<GenerateBracketResult> => {
    const response = await axios.post<{ phaseId: number; phaseGroupId: number }>(
      `divisions/${request.divisionId}/generate-bracket`,
      {
        phaseName: request.phaseName,
        bracketType: request.bracketType,
        playerPerMatch: request.playerPerMatch,
      },
    );
    await refreshDivision(request.divisionId);
    setGenerateBracketOpen(false);
    return {
      divisionId: request.divisionId,
      phaseId: response.data.phaseId,
      phaseGroupId: response.data.phaseGroupId,
    };
  }, [refreshDivision]);

  return {
    divisions,
    tournamentName,
    syncstartUrl,
    createDivisionOpen,
    createPhaseOpen,
    createPhaseGroupOpen,
    generateBracketOpen,
    createMenuOpen,
    bracketTypes,
    setCreateDivisionOpen,
    setCreatePhaseOpen,
    setCreatePhaseGroupOpen,
    setGenerateBracketOpen,
    setCreateMenuOpen,
    setSyncstartUrl,
    refreshDivisions,
    handleCreateDivision,
    handleCreatePhase,
    handleCreatePhaseGroup,
    handleGenerateBracket,
  };
}
