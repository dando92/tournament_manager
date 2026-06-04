import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Entrant } from "@/features/entrant/types/Entrant";
import { Song } from "@/features/song/types/Song";
import { CreateMatchRequest } from "@/features/match/types/match-requests";
import { MatchPhaseOption } from "@/features/match/types/MatchPhaseOption";
import { TournamentDivisionOption } from "@/features/tournament/types/TournamentDivisionOption";

type UseCreateMatchModalOptions = {
  open: boolean;
  onClose: () => void;
  onCreate: (request: CreateMatchRequest) => void;
  phaseId?: number;
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
  const [songAddType, setSongAddType] = useState<"title" | "roll">("roll");
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
  const resolvedPhaseGroupId = selectedPhaseGroupId ?? availablePhaseGroups[0]?.id ?? null;

  useEffect(() => {
    if (!open) return;

    const initialDivisionId = divisionId ?? divisions?.[0]?.id ?? null;
    const initialPhases = divisionId
      ? phases ?? []
      : divisions?.find((division) => division.id === initialDivisionId)?.phases ?? [];

    setSelectedDivisionId(initialDivisionId);
    const nextPhaseId = phaseId ?? initialPhases[0]?.id ?? null;
    setSelectedPhaseId(nextPhaseId);
    setSelectedPhaseGroupId(initialPhases.find((phase) => phase.id === nextPhaseId)?.phaseGroups?.[0]?.id ?? null);
    setSelectedEntrants([]);
    setSelectedSongs([]);
    setSelectedSongDifficulties([]);
    setDifficultyInput("");
    setSongAddType("roll");
  }, [divisionId, divisions, open, phaseId, phases]);

  useEffect(() => {
    if (!open || divisionId || phaseId) return;
    const nextPhases = divisions?.find((division) => division.id === selectedDivisionId)?.phases ?? [];
    setSelectedPhaseId(nextPhases[0]?.id ?? null);
    setSelectedPhaseGroupId(nextPhases[0]?.phaseGroups?.[0]?.id ?? null);
  }, [divisionId, divisions, open, phaseId, selectedDivisionId]);

  useEffect(() => {
    if (!open) return;
    if (selectedPhaseGroupId && availablePhaseGroups.some((group) => group.id === selectedPhaseGroupId)) return;
    setSelectedPhaseGroupId(availablePhaseGroups[0]?.id ?? null);
  }, [availablePhaseGroups, open, selectedPhaseGroupId]);

  useEffect(() => {
    if (!open || !resolvedDivisionId) return;
    axios.get<Entrant[]>(`divisions/${resolvedDivisionId}/entrants`).then((response) => {
      setEntrants(response.data.filter((entrant) => entrant.status === "active" && entrant.type === "player"));
    });
  }, [open, resolvedDivisionId]);

  useEffect(() => {
    if (!open) return;
    axios
      .get<Song[]>(tournamentId ? `songs?tournamentId=${tournamentId}` : "songs")
      .then((response) => {
        setSongs(response.data);
        setSongGroups([...new Set(response.data.map((song) => song.group))]);
        setSelectedGroupName(response.data[0]?.group ?? "");
      });
  }, [open, tournamentId]);

  useEffect(() => {
    if (!open) return;
    axios.get<string[]>("matches/scoring-systems").then((response) => {
      setScoringSystems(response.data);
      setScoringSystem(response.data[0] ?? "");
    });
  }, [open]);

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
