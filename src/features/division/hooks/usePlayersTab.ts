import { useEffect, useMemo, useState } from "react";
import { Division } from "@/features/division/types/Division";
import { Participant } from "@/features/entrant/types/Entrant";
import {
  addParticipantToDivision,
  listAvailableParticipantsForDivision,
  removeParticipantFromDivision,
} from "@/features/participant/services/participant.api";

type UsePlayersTabOptions = {
  division: Division;
  onPlayersChanged: () => void;
};

export function usePlayersTab({ division, onPlayersChanged }: UsePlayersTabOptions) {
  const [divisionParticipants, setDivisionParticipants] = useState<Participant[]>(
    (division.entrants ?? []).flatMap((entrant) => entrant.participants ?? []).filter(Boolean),
  );
  const [availableParticipants, setAvailableParticipants] = useState<Participant[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    listAvailableParticipantsForDivision(division.id).then(setAvailableParticipants).catch(() => {});
  }, [division.id]);

  useEffect(() => {
    setDivisionParticipants((division.entrants ?? []).flatMap((entrant) => entrant.participants ?? []).filter(Boolean));
  }, [division.entrants]);

  const divisionParticipantIds = useMemo(
    () => new Set(divisionParticipants.map((participant) => participant.id)),
    [divisionParticipants],
  );
  const lowerSearch = search.toLowerCase();

  const filteredAllParticipants = useMemo(
    () =>
      [...divisionParticipants, ...availableParticipants]
        .filter((participant, index, participants) => participants.findIndex((candidate) => candidate.id === participant.id) === index)
        .filter((participant) => participant.player.playerName.toLowerCase().includes(lowerSearch))
        .sort((a, b) => a.player.playerName.localeCompare(b.player.playerName)),
    [availableParticipants, divisionParticipants, lowerSearch],
  );

  const handleAdd = async (participant: Participant) => {
    setDivisionParticipants((prev) => (prev.some((entry) => entry.id === participant.id) ? prev : [...prev, participant]));
    setAvailableParticipants((prev) => prev.filter((entry) => entry.id !== participant.id));

    try {
      await addParticipantToDivision(division.id, participant.id);
      onPlayersChanged();
    } catch {
      setDivisionParticipants((prev) => prev.filter((entry) => entry.id !== participant.id));
      setAvailableParticipants((prev) => [...prev, participant].sort((a, b) => a.player.playerName.localeCompare(b.player.playerName)));
    }
  };

  const handleRemove = async (participantId: number) => {
    const participant = divisionParticipants.find((entry) => entry.id === participantId);
    try {
      await removeParticipantFromDivision(division.id, participantId);
      setDivisionParticipants((prev) => prev.filter((participant) => participant.id !== participantId));
      if (participant) {
        setAvailableParticipants((prev) => [...prev, participant].sort((a, b) => a.player.playerName.localeCompare(b.player.playerName)));
      }
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
