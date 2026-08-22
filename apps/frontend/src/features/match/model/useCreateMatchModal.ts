import { useEffect, useMemo, useState } from "react";
import { Entrant } from "@/features/entrant/types/Entrant";
import { Song } from "@/features/song/types/Song";
import { CreateMatchRequest, MatchPhaseOption } from "@/features/match/model/types";
import { TournamentDivisionOption } from "@/features/tournament/model/types";
import { listDivisionEntrants } from "@/features/division/services/divisions.api";
import { getTournament } from "@/features/tournament/api/tournament.api";
import { listScoringSystems } from "@/features/match/api/match.api";
import { listSongs } from "@/features/song/api/song.api";

type UseCreateMatchModalOptions = {
  open: boolean;
  onClose: () => void;
  onCreate: (request: CreateMatchRequest) => void;
  phaseId?: number;
  phaseGroupId?: number;
  phases?: MatchPhaseOption[];
  divisionId?: number;
  divisions?: TournamentDivisionOption[];
  tournamentId?: number;
};

export function useCreateMatchModal({
  open,
  onClose,
  onCreate,
  phaseId,
  phaseGroupId,
  phases,
  divisionId,
  divisions,
  tournamentId,
}: UseCreateMatchModalOptions) {
  const [selectedDivisionId, setSelectedDivisionId] = useState<number | null>(
    divisionId ?? divisions?.[0]?.id ?? null,
  );
  const [selectedPhaseId, setSelectedPhaseId] = useState<number | null>(null);
  const [selectedPhaseGroupId, setSelectedPhaseGroupId] = useState<number | null>(null);
  const [entrants, setEntrants] = useState<Entrant[]>([]);
  const [scoringSystems, setScoringSystems] = useState<string[]>([]);
  const [scoringSystem, setScoringSystem] = useState("");
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [selectedEntrants, setSelectedEntrants] = useState<Entrant[]>([]);
  const [songAddType, setSongAddType] = useState<"title" | "roll">("title");
  const [selectedSongDifficulties, setSelectedSongDifficulties] = useState<string[]>([]);
  const [difficultyInput, setDifficultyInput] = useState("");
  const [songs, setSongs] = useState<Song[]>([]);
  const [songGroups, setSongGroups] = useState<string[]>([]);
  const [selectedGroupName, setSelectedGroupName] = useState("");
  const [selectedSongs, setSelectedSongs] = useState<Song[]>([]);

  const availablePhases = useMemo<MatchPhaseOption[]>(
    () =>
      divisionId
        ? phases ?? []
        : divisions?.find((division) => division.id === selectedDivisionId)?.phases ?? [],
    [divisionId, divisions, phases, selectedDivisionId],
  );

  const resolvedPhaseId = phaseId ?? selectedPhaseId;
  const resolvedDivisionId = divisionId ?? selectedDivisionId;
  const availablePhaseGroups = useMemo(
    () => availablePhases.find((phase) => phase.id === resolvedPhaseId)?.phaseGroups ?? [],
    [availablePhases, resolvedPhaseId],
  );
  const resolvedPhaseGroupId = phaseGroupId ?? selectedPhaseGroupId ?? availablePhaseGroups[0]?.id ?? null;

  useEffect(() => {
    if (!open) return;

    const initialDivisionId = divisionId ?? divisions?.[0]?.id ?? null;
    const initialPhases = divisionId
      ? phases ?? []
      : divisions?.find((division) => division.id === initialDivisionId)?.phases ?? [];

    setSelectedDivisionId(initialDivisionId);
    const nextPhaseId = phaseId ?? initialPhases[0]?.id ?? null;
    setSelectedPhaseId(nextPhaseId);
    setSelectedPhaseGroupId(phaseGroupId ?? initialPhases.find((phase) => phase.id === nextPhaseId)?.phaseGroups?.[0]?.id ?? null);
    setSelectedEntrants([]);
    setSelectedSongs([]);
    setSelectedSongDifficulties([]);
    setDifficultyInput("");
    setSongAddType("title");
  }, [divisionId, divisions, open, phaseGroupId, phaseId, phases]);

  useEffect(() => {
    if (!open || divisionId || phaseId) return;
    const nextPhases = divisions?.find((division) => division.id === selectedDivisionId)?.phases ?? [];
    setSelectedPhaseId(nextPhases[0]?.id ?? null);
    setSelectedPhaseGroupId(phaseGroupId ?? nextPhases[0]?.phaseGroups?.[0]?.id ?? null);
  }, [divisionId, divisions, open, phaseGroupId, phaseId, selectedDivisionId]);

  useEffect(() => {
    if (!open) return;
    if (phaseGroupId) {
      setSelectedPhaseGroupId(phaseGroupId);
      return;
    }
    if (selectedPhaseGroupId && availablePhaseGroups.some((group) => group.id === selectedPhaseGroupId)) return;
    setSelectedPhaseGroupId(availablePhaseGroups[0]?.id ?? null);
  }, [availablePhaseGroups, open, phaseGroupId, selectedPhaseGroupId]);

  useEffect(() => {
    if (!open || !resolvedDivisionId) {
      setEntrants([]);
      return;
    }

    let cancelled = false;
    listDivisionEntrants(resolvedDivisionId)
      .then((divisionEntrants) => {
        if (cancelled) return;
        setEntrants(
          divisionEntrants
            .filter((entrant) => entrant.status === "active" && entrant.type === "player")
            .sort((left, right) => left.name.localeCompare(right.name)),
        );
      })
      .catch(() => {
        if (!cancelled) setEntrants([]);
      });

    return () => {
      cancelled = true;
    };
  }, [open, resolvedDivisionId]);

  useEffect(() => {
    const entrantIds = new Set(entrants.map((entrant) => entrant.id));
    setSelectedEntrants((current) => current.filter((entrant) => entrantIds.has(entrant.id)));
  }, [entrants]);

  useEffect(() => {
    if (!open) return;
    listSongs(tournamentId)
      .then((catalog) => {
        setSongs(catalog);
        setSongGroups([...new Set(catalog.map((song) => song.group))]);
        setSelectedGroupName(catalog[0]?.group ?? "");
      })
      .catch(() => setSongs([]));
  }, [open, tournamentId]);

  useEffect(() => {
    if (!open) return;
    const scoringSystemsRequest = listScoringSystems();
    const tournamentRequest = tournamentId ? getTournament(tournamentId) : Promise.resolve(null);

    Promise.all([scoringSystemsRequest, tournamentRequest]).then(([systems, tournament]) => {
      const defaultScoringSystem = tournament?.defaultScoringSystem;
      setScoringSystems(systems);
      setScoringSystem(defaultScoringSystem && systems.includes(defaultScoringSystem) ? defaultScoringSystem : systems[0] ?? "");
    });
  }, [open, tournamentId]);

  const addDifficulty = () => {
    if (!difficultyInput) return;
    setSelectedSongDifficulties((prev) => [...prev, difficultyInput]);
    setDifficultyInput("");
  };

  const removeDifficulty = (index: number) => {
    setSelectedSongDifficulties((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleSubmit = () => {
    if (!resolvedPhaseGroupId || !resolvedDivisionId) return;

    const baseRequest = {
      phaseGroupId: resolvedPhaseGroupId,
      divisionId: resolvedDivisionId,
      name,
      subtitle,
      group: selectedGroupName,
      scoringSystem,
      entrantIds: selectedEntrants.map((entrant) => entrant.id),
    };

    const request: CreateMatchRequest =
      songAddType === "title"
        ? {
            ...baseRequest,
            songIds: selectedSongs.map((song) => song.id),
          } as CreateMatchRequest
        : {
            ...baseRequest,
            levels: selectedSongDifficulties.join(","),
          } as CreateMatchRequest;

    onCreate(request);
    onClose();
  };

  return {
    entrants,
    songs,
    songGroups,
    scoringSystems,
    selectedDivisionId,
    selectedPhaseId,
    selectedPhaseGroupId,
    selectedEntrants,
    selectedSongs,
    selectedSongDifficulties,
    selectedGroupName,
    difficultyInput,
    scoringSystem,
    name,
    subtitle,
    songAddType,
    availablePhases,
    availablePhaseGroups,
    setSelectedDivisionId,
    setSelectedPhaseId,
    setSelectedPhaseGroupId,
    setSelectedEntrants,
    setSelectedSongs,
    setSelectedGroupName,
    setDifficultyInput,
    setScoringSystem,
    setName,
    setSubtitle,
    setSongAddType,
    addDifficulty,
    removeDifficulty,
    handleSubmit,
  };
}
