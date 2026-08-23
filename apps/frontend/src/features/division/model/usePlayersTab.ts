import { useCallback, useEffect, useMemo, useState } from "react";
import { Division } from "@/features/division/model/types";
import { Entrant, Participant } from "@/features/participant/model/types";
import {
  addParticipantToDivision,
  listAvailableParticipantsForDivision,
  removeParticipantFromDivision,
} from "@/features/participant/api/participant.api";

type UsePlayersTabOptions = {
  division: Division;
  entrants: Entrant[];
  orderByName: boolean;
};

/**
 * Who is competing in the division right now.
 *
 * The roster itself arrives through the query cache: admitting or withdrawing
 * somebody publishes a division event, which stales the roster and the counts
 * the tree draws. What is left here is the list of people who are available to
 * add, which is read for this tab alone.
 *
 * Removing somebody withdraws their entrant rather than deleting it, so the
 * roster keeps the row and states its status. A withdrawn entrant is not
 * somebody the division holds: counting it made a removed person keep their
 * Remove button, while the division they had left went on holding their seat.
 */
function competing(entrants: Entrant[]): Participant[] {
  return entrants
    .filter((entrant) => entrant.status === "active")
    .flatMap((entrant) => entrant.participants ?? [])
    .filter(Boolean);
}

export function usePlayersTab({ division, entrants, orderByName }: UsePlayersTabOptions) {
  const [divisionParticipants, setDivisionParticipants] = useState<Participant[]>(competing(entrants));
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
    setDivisionParticipants(competing(entrants));
  }, [entrants]);

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
