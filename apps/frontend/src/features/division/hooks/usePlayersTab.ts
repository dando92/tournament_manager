import { useCallback, useEffect, useMemo, useState } from "react";
import { Division } from "@/features/division/types/Division";
import { Participant } from "@/features/entrant/types/Entrant";
import {
  addParticipantToDivision,
  listAvailableParticipantsForDivision,
  removeParticipantFromDivision,
} from "@/features/participant/services/participant.api";

type UsePlayersTabOptions = {
  division: Division;
  orderByName: boolean;
  onPlayersChanged: () => void;
};

export function usePlayersTab({ division, orderByName, onPlayersChanged }: UsePlayersTabOptions) {
  const [divisionParticipants, setDivisionParticipants] = useState<Participant[]>(
    (division.entrants ?? []).flatMap((entrant) => entrant.participants ?? []).filter(Boolean),
  );
  const [availableParticipants, setAvailableParticipants] = useState<Participant[]>([]);
  const [search, setSearch] = useState("");

  const loadAvailableParticipants = useCallback(async () => {
    const participants = await listAvailableParticipantsForDivision(division.id);
    setAvailableParticipants(participants);
  }, [division.id]);

  useEffect(() => {
    loadAvailableParticipants().catch(() => {});
  }, [loadAvailableParticipants]);

  useEffect(() => {
    setDivisionParticipants((division.entrants ?? []).flatMap((entrant) => entrant.participants ?? []).filter(Boolean));
  }, [division.entrants]);

  const divisionParticipantIds = useMemo(
    () => new Set(divisionParticipants.map((participant) => participant.id)),
    [divisionParticipants],
  );
  const lowerSearch = search.toLowerCase();

  const filteredAllParticipants = useMemo(
    () => {
      const participants = [...divisionParticipants, ...availableParticipants]
        .filter((participant, index, participants) => participants.findIndex((candidate) => candidate.id === participant.id) === index)
        .filter((participant) => participant.player.playerName.toLowerCase().includes(lowerSearch));

      return orderByName
        ? participants.sort((a, b) => a.player.playerName.localeCompare(b.player.playerName))
        : participants;
    },
    [availableParticipants, divisionParticipants, lowerSearch, orderByName],
  );

  const handleAdd = async (participant: Participant) => {
    setDivisionParticipants((prev) => (prev.some((entry) => entry.id === participant.id) ? prev : [...prev, participant]));
    setAvailableParticipants((prev) => prev.filter((entry) => entry.id !== participant.id));

    try {
      await addParticipantToDivision(division.id, participant.id);
      await loadAvailableParticipants();
      onPlayersChanged();
    } catch {
      setDivisionParticipants((prev) => prev.filter((entry) => entry.id !== participant.id));
      setAvailableParticipants((prev) => [...prev, participant]);
    }
  };

  const handleRemove = async (participantId: number) => {
    const participant = divisionParticipants.find((entry) => entry.id === participantId);
    try {
      await removeParticipantFromDivision(division.id, participantId);
      setDivisionParticipants((prev) => prev.filter((participant) => participant.id !== participantId));
      if (participant) setAvailableParticipants((prev) => [...prev, participant]);
      await loadAvailableParticipants();
      onPlayersChanged();
    } catch {
      // handled by axios interceptor
    }
  };

  return {
    search,
    divisionParticipantIds,
    filteredAllParticipants,
    setSearch,
    handleAdd,
    handleRemove,
  };
}
