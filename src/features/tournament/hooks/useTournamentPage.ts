import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { Tournament } from "@/features/tournament/types/Tournament";
import { addRecentTournament } from "@/features/tournament/services/recentTournaments";
import { useTournamentUpdates } from "@/features/tournament/context/TournamentUpdatesContext";
import * as MatchesApi from "@/features/match/services/matches.api";
import { CreateMatchRequest } from "@/features/match/types/match-requests";
import { TournamentOverview } from "@/features/tournament/types/TournamentOverview";
import { TournamentDivisionOption } from "@/features/tournament/types/TournamentDivisionOption";
import { Division } from "@/features/division/types/Division";
import { Phase } from "@/features/division/types/Phase";

type UseTournamentPageOptions = {
  tournamentId: number;
  canControl: boolean;
};

export type TournamentPageState = {
  divisions: TournamentDivisionOption[];
  tournamentName: string;
  syncstartUrl: string;
  createDivisionOpen: boolean;
  selectDivisionOpen: boolean;
  createPhaseOpen: boolean;
  createMatchOpen: boolean;
  generateBracketDivisionId: number | null;
  bracketTypes: string[];
  createMenuOpen: boolean;
  setCreateDivisionOpen: Dispatch<SetStateAction<boolean>>;
  setSelectDivisionOpen: Dispatch<SetStateAction<boolean>>;
  setCreatePhaseOpen: Dispatch<SetStateAction<boolean>>;
  setCreateMatchOpen: Dispatch<SetStateAction<boolean>>;
  setGenerateBracketDivisionId: Dispatch<SetStateAction<number | null>>;
  setCreateMenuOpen: Dispatch<SetStateAction<boolean>>;
  setSyncstartUrl: Dispatch<SetStateAction<string>>;
  refreshDivisions: () => Promise<void>;
  handleCreateDivision: (name: string, playersPerMatch: number | null) => void;
  handleCreatePhase: (name: string, divisionId: number) => Promise<void>;
  handleCreateMatch: (request: CreateMatchRequest) => Promise<void>;
  handleGenerateBracket: (bracketType: string, playerPerMatch: number) => Promise<void>;
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
  const [selectDivisionOpen, setSelectDivisionOpen] = useState(false);
  const [createPhaseOpen, setCreatePhaseOpen] = useState(false);
  const [createMatchOpen, setCreateMatchOpen] = useState(false);
  const [generateBracketDivisionId, setGenerateBracketDivisionId] = useState<number | null>(null);
  const [bracketTypes, setBracketTypes] = useState<string[]>([]);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
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
    if (!canControl) return;
    axios.get<string[]>("bracket/bracket-types")
      .then((r) => setBracketTypes(r.data))
      .catch(() => {});
  }, [canControl]);

  useEffect(() => {
    if (tournamentVersion === 0) return;
    refreshDivisions().catch(() => {});
  }, [refreshDivisions, tournamentVersion]);

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

  const handleGenerateBracket = useCallback(async (_bracketType: string, _playerPerMatch: number) => {
    if (!generateBracketDivisionId) return;
    await refreshDivision(generateBracketDivisionId);
    setGenerateBracketDivisionId(null);
  }, [generateBracketDivisionId, refreshDivision]);

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

  const handleCreateMatch = useCallback(async (request: CreateMatchRequest) => {
    await MatchesApi.create(request);
    const divisionId = request.divisionId;
    if (!divisionId) return;

    setDivisions((prev) =>
      prev.map((division) =>
        division.id === divisionId
          ? {
              ...division,
              phases: division.phases.map((phase) =>
                phase.phaseGroups?.some((group) => group.id === request.phaseGroupId)
                  ? { ...phase, matchCount: phase.matchCount + 1 }
                  : phase,
              ),
            }
          : division,
      ),
    );
  }, []);

  return {
    divisions,
    tournamentName,
    syncstartUrl,
    createDivisionOpen,
    selectDivisionOpen,
    createPhaseOpen,
    createMatchOpen,
    generateBracketDivisionId,
    bracketTypes,
    createMenuOpen,
    setCreateDivisionOpen,
    setSelectDivisionOpen,
    setCreatePhaseOpen,
    setCreateMatchOpen,
    setGenerateBracketDivisionId,
    setCreateMenuOpen,
    setSyncstartUrl,
    refreshDivisions,
    handleCreateDivision,
    handleCreatePhase,
    handleCreateMatch,
    handleGenerateBracket,
  };
}
