import { useCallback, useEffect, useMemo, useState } from "react";
import { Participant } from "@/features/entrant/types/Entrant";
import { Player } from "@/features/player/types/Player";
import { getAllPlayers } from "@/features/player/services/player.api";
import {
  ParticipantsManageModal,
  useTournamentPageContext,
} from "@/features/tournament/model/TournamentPageContext";
import {
  createParticipant,
  importParticipants,
  listParticipants,
  makeParticipantStaff,
  previewParticipantImport,
  removeParticipant,
  removeParticipantStaff,
  type ParticipantImportPreviewEntry,
} from "@/features/participant/services/participant.api";

/**
 * The participant roster and the three ways of adding to it: one name, a
 * selection from the player database, or a pasted list.
 *
 * The roster is re-read after every change rather than patched in place: a
 * registration can create a player, and a staff change can come from
 * elsewhere, so the server's answer is the only complete one.
 */
export function useTournamentParticipantsPage() {
  const { tournamentId, controls, participantsManageModal, setParticipantsManageModal } =
    useTournamentPageContext();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [name, setName] = useState("");
  const [participantSearch, setParticipantSearch] = useState("");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<number[]>([]);
  const [bulkText, setBulkText] = useState("");
  const [preview, setPreview] = useState<ParticipantImportPreviewEntry[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [previousManageModal, setPreviousManageModal] = useState<ParticipantsManageModal>("none");

  const refreshParticipants = useCallback(async () => {
    setParticipants(await listParticipants(tournamentId));
  }, [tournamentId]);

  useEffect(() => {
    refreshParticipants().catch(() => {});
    getAllPlayers().then(setAllPlayers).catch(() => {});
  }, [refreshParticipants, tournamentId]);

  /* The start.gg import runs in a modal the header owns, so its closing is the
     only signal that the roster may have changed. */
  useEffect(() => {
    if (previousManageModal === "startgg" && participantsManageModal === "none") {
      refreshParticipants().catch(() => {});
    }
    setPreviousManageModal(participantsManageModal);
  }, [participantsManageModal, previousManageModal, refreshParticipants]);

  const participantPlayerIds = useMemo(
    () => new Set(participants.map((participant) => participant.player.id)),
    [participants],
  );
  const availablePlayers = useMemo(
    () =>
      allPlayers
        .filter((player) => !participantPlayerIds.has(player.id))
        .sort((a, b) => a.playerName.localeCompare(b.playerName)),
    [allPlayers, participantPlayerIds],
  );
  const availablePlayerOptions = useMemo(
    () => availablePlayers.map((player) => ({ value: player.id, label: player.playerName })),
    [availablePlayers],
  );
  const selectedPlayerOptions = useMemo(
    () =>
      selectedPlayerIds
        .map((playerId) => availablePlayerOptions.find((option) => option.value === playerId))
        .filter((option): option is { value: number; label: string } => Boolean(option)),
    [availablePlayerOptions, selectedPlayerIds],
  );
  const filteredParticipants = useMemo(
    () =>
      participants.filter((participant) =>
        participant.player.playerName.toLowerCase().includes(participantSearch.toLowerCase()),
      ),
    [participantSearch, participants],
  );

  async function handleRegister() {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await createParticipant(tournamentId, { playerName: name.trim() });
      setName("");
      setParticipantsManageModal("none");
      await refreshParticipants();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddExistingPlayers() {
    if (selectedPlayerIds.length === 0) return;
    setSubmitting(true);
    try {
      await Promise.all(selectedPlayerIds.map((playerId) => createParticipant(tournamentId, { playerId })));
      setSelectedPlayerIds([]);
      setParticipantsManageModal("none");
      await refreshParticipants();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(participantId: number) {
    await removeParticipant(tournamentId, participantId);
    await refreshParticipants();
  }

  async function handleMakeStaff(participantId: number) {
    await makeParticipantStaff(tournamentId, participantId);
    await refreshParticipants();
  }

  async function handleRemoveStaff(participantId: number) {
    await removeParticipantStaff(tournamentId, participantId);
    await refreshParticipants();
  }

  async function handlePreviewImport() {
    const names = bulkText.split("\n").map((entry) => entry.trim()).filter(Boolean);
    if (names.length === 0) return;
    setLoadingPreview(true);
    try {
      setPreview(await previewParticipantImport(tournamentId, names));
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleConfirmImport() {
    const entries = preview
      .filter((entry) => !entry.alreadyParticipant)
      .map((entry) => ({
        name: entry.name,
        playerId: entry.matchedPlayer?.id,
      }));
    if (entries.length === 0) {
      setParticipantsManageModal("none");
      return;
    }

    setSubmitting(true);
    try {
      await importParticipants(tournamentId, entries);
      setBulkText("");
      setPreview([]);
      setParticipantsManageModal("none");
      await refreshParticipants();
    } finally {
      setSubmitting(false);
    }
  }

  return {
    tournamentId,
    controls,
    participants,
    filteredParticipants,
    participantSearch,
    setParticipantSearch,
    name,
    setName,
    availablePlayers,
    availablePlayerOptions,
    selectedPlayerOptions,
    setSelectedPlayerIds,
    selectedPlayerIds,
    bulkText,
    setBulkText,
    preview,
    loadingPreview,
    submitting,
    manageModal: participantsManageModal,
    closeManageModal: () => setParticipantsManageModal("none"),
    handleRegister,
    handleAddExistingPlayers,
    handleRemove,
    handleMakeStaff,
    handleRemoveStaff,
    handlePreviewImport,
    handleConfirmImport,
  };
}
