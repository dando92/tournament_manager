import { useCallback, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMagnifyingGlass,
  faUserShield,
  faUserSlash,
} from "@fortawesome/free-solid-svg-icons";
import { Navigate } from "react-router-dom";
import BaseModal from "@/shared/components/ui/BaseModal";
import MultiSelect from "@/shared/components/ui/MultiSelect";
import DeleteConfirmButton from "@/shared/components/ui/DeleteConfirmButton";
import { btnPrimary, btnSecondary } from "@/styles/buttonStyles";
import { Participant } from "@/features/entrant/types/Entrant";
import { Player } from "@/features/player/types/Player";
import { getAllPlayers } from "@/features/player/services/player.api";
import { ParticipantsManageModal, useTournamentPageContext } from "@/features/tournament/context/TournamentPageContext";
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

export default function TournamentParticipantsPage() {
  const { tournamentId, controls, participantsManageModal, setParticipantsManageModal } = useTournamentPageContext();
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
    const response = await listParticipants(tournamentId);
    setParticipants(response);
  }, [tournamentId]);

  useEffect(() => {
    refreshParticipants().catch(() => {});
    getAllPlayers().then(setAllPlayers).catch(() => {});
  }, [refreshParticipants, tournamentId]);

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

  if (!controls) {
    return <Navigate to={`/tournament/${tournamentId}/overview`} replace />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <FontAwesomeIcon
          icon={faMagnifyingGlass}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"
        />
        <input
          type="search"
          value={participantSearch}
          onChange={(event) => setParticipantSearch(event.target.value)}
          placeholder="Search participants by name..."
          className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-dark/30"
        />
      </div>

      <div className="grid gap-2">
        {filteredParticipants.length === 0 ? (
          <p className="text-sm text-gray-400 italic">
            {participants.length === 0 ? "No participants registered." : "No participants match your search."}
          </p>
        ) : (
          filteredParticipants.map((participant) => {
            const isOwner = participant.roles.includes("owner");
            const isStaff = participant.roles.includes("staff");
            const roleLabel = isOwner ? "owner" : isStaff ? "staff" : null;

            return (
              <div
                key={participant.id}
                className={`flex items-center justify-between rounded border px-4 py-3 text-sm ${
                  roleLabel ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-white"
                }`}
              >
                <div>
                  <p className="font-medium text-gray-900">{participant.player.playerName}</p>
                  <p className="text-xs text-gray-500">
                    {participant.status}
                    {roleLabel ? ` | ${roleLabel}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {controls && !isOwner && (
                    isStaff ? (
                      <button
                        type="button"
                        onClick={() => handleRemoveStaff(participant.id)}
                        className={`${btnSecondary} px-3 py-1.5 text-xs`}
                      >
                        <FontAwesomeIcon icon={faUserSlash} className="mr-1.5" />
                        Remove from staff
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleMakeStaff(participant.id)}
                        className={`${btnSecondary} px-3 py-1.5 text-xs`}
                      >
                        <FontAwesomeIcon icon={faUserShield} className="mr-1.5" />
                        Make staff
                      </button>
                    )
                  )}
                  {controls && !roleLabel && (
                    <DeleteConfirmButton
                      onConfirm={() => handleRemove(participant.id)}
                      title="Remove participant"
                      className="text-sm"
                      confirmMessage={`Remove "${participant.player.playerName}" from this tournament?`}
                      confirmText="Remove"
                    />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <BaseModal
        open={participantsManageModal === "register"}
        onClose={() => setParticipantsManageModal("none")}
        title="Register participant"
        maxWidth="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setParticipantsManageModal("none")} className={`${btnSecondary} text-sm`}>
              Cancel
            </button>
            <button onClick={handleRegister} disabled={submitting || !name.trim()} className={`${btnPrimary} text-sm`}>
              {submitting ? "Saving..." : "Register"}
            </button>
          </div>
        }
      >
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Enter gamer tag"
          autoFocus
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-dark/30"
        />
      </BaseModal>

      <BaseModal open={participantsManageModal === "database"} onClose={() => setParticipantsManageModal("none")} title="Add from player database" maxWidth="max-w-md">
        <div className="flex flex-col gap-3">
          {availablePlayers.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No available players.</p>
          ) : (
            <MultiSelect
              options={availablePlayerOptions}
              value={selectedPlayerOptions}
              onChange={(selected) => setSelectedPlayerIds(selected.map((option) => option.value))}
              placeholder="Select players..."
            />
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setParticipantsManageModal("none")} className={`${btnSecondary} text-sm`}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddExistingPlayers}
              disabled={submitting || selectedPlayerIds.length === 0}
              className={`${btnPrimary} text-sm`}
            >
              {submitting ? "Adding..." : `Add selected${selectedPlayerIds.length > 0 ? ` (${selectedPlayerIds.length})` : ""}`}
            </button>
          </div>
        </div>
      </BaseModal>

      <BaseModal
        open={participantsManageModal === "import"}
        onClose={() => setParticipantsManageModal("none")}
        title="Import participants"
        maxWidth="max-w-2xl"
        footer={
          <div className="flex justify-between gap-2">
            <button onClick={handlePreviewImport} disabled={loadingPreview || !bulkText.trim()} className={`${btnSecondary} text-sm`}>
              {loadingPreview ? "Previewing..." : "Preview"}
            </button>
            <div className="flex gap-2">
              <button onClick={() => setParticipantsManageModal("none")} className={`${btnSecondary} text-sm`}>
                Cancel
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={submitting || preview.length === 0}
                className={`${btnPrimary} text-sm`}
              >
                {submitting ? "Importing..." : "Confirm import"}
              </button>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <textarea
            value={bulkText}
            onChange={(event) => setBulkText(event.target.value)}
            placeholder={"Alice\nBob\nCharlie"}
            rows={8}
            className="w-full resize-none rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-dark/30"
          />

          {preview.length > 0 && (
            <div className="grid gap-2">
              {preview.map((entry) => (
                <div key={entry.name} className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-gray-900">{entry.name}</span>
                    <span className="text-xs text-gray-500">
                      {entry.alreadyParticipant
                        ? "Already participant"
                        : entry.matchedPlayer
                          ? `Match: ${entry.matchedPlayer.playerName}`
                          : "Create local player"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </BaseModal>
    </div>
  );
}
