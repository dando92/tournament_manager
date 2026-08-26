import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faDownload,
  faMagnifyingGlass,
  faSpinner,
  faUserShield,
  faUserSlash,
} from "@fortawesome/free-solid-svg-icons";
import { Navigate } from "react-router-dom";
import BaseModal from "@/shared/components/ui/BaseModal";
import MultiSelect from "@/shared/components/ui/MultiSelect";
import DeleteConfirmButton from "@/shared/components/ui/DeleteConfirmButton";
import { btnPrimary, btnSecondary } from "@/styles/buttonStyles";
import { useTournamentParticipantsPage } from "@/features/tournament/model/useTournamentParticipantsPage";

export default function ParticipantsPage() {
  const {
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
    participantsLoading,
    profileExporting,
    manageModal,
    closeManageModal,
    handleRegister,
    handleAddExistingPlayers,
    handleRemove,
    handleMakeStaff,
    handleRemoveStaff,
    handlePreviewImport,
    handleConfirmImport,
    handleExportItgmaniaProfiles,
  } = useTournamentParticipantsPage();

  if (!controls) {
    return <Navigate to={`/tournament/${tournamentId}/overview`} replace />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <FontAwesomeIcon
            icon={faMagnifyingGlass}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ui-text-mute text-sm"
          />
          <input
            type="search"
            value={participantSearch}
            onChange={(event) => setParticipantSearch(event.target.value)}
            placeholder="Search participants by name..."
            className="w-full rounded-lg border border-ui-border-strong py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ui-accent"
          />
        </div>
        <button
          type="button"
          onClick={handleExportItgmaniaProfiles}
          disabled={participantsLoading || profileExporting}
          className={`flex shrink-0 items-center gap-2 text-xs font-medium ${btnSecondary}`}
          title="Export ITGmania profiles"
        >
          <FontAwesomeIcon icon={profileExporting ? faSpinner : faDownload} className={profileExporting ? "animate-spin" : undefined} />
          {profileExporting ? "Exporting..." : "Export ITGmania"}
        </button>
      </div>

      <div className="grid gap-2">
        {filteredParticipants.length === 0 ? (
          <p className="text-sm text-ui-text-mute italic">
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
                  roleLabel ? "border-state-pending/30 bg-state-pending/10" : "border-ui-border bg-ui-surface"
                }`}
              >
                <div>
                  <p className="font-medium text-ui-text">{participant.player.playerName}</p>
                  <p className="text-xs text-ui-text-mute">
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
        open={manageModal === "register"}
        onClose={closeManageModal}
        title="Register participant"
        maxWidth="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={closeManageModal} className={`${btnSecondary} text-sm`}>
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
          className="w-full rounded border border-ui-border-strong px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ui-accent"
        />
      </BaseModal>

      <BaseModal open={manageModal === "database"} onClose={closeManageModal} title="Add from player database" maxWidth="max-w-md">
        <div className="flex flex-col gap-3">
          {availablePlayers.length === 0 ? (
            <p className="text-sm text-ui-text-mute italic">No available players.</p>
          ) : (
            <MultiSelect
              options={availablePlayerOptions}
              value={selectedPlayerOptions}
              onChange={(selected) => setSelectedPlayerIds(selected.map((option) => option.value))}
              placeholder="Select players..."
            />
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={closeManageModal} className={`${btnSecondary} text-sm`}>
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
        open={manageModal === "import"}
        onClose={closeManageModal}
        title="Import participants"
        maxWidth="max-w-2xl"
        footer={
          <div className="flex justify-between gap-2">
            <button onClick={handlePreviewImport} disabled={loadingPreview || !bulkText.trim()} className={`${btnSecondary} text-sm`}>
              {loadingPreview ? "Previewing..." : "Preview"}
            </button>
            <div className="flex gap-2">
              <button onClick={closeManageModal} className={`${btnSecondary} text-sm`}>
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
            className="w-full resize-none rounded border border-ui-border-strong px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ui-accent"
          />

          {preview.length > 0 && (
            <div className="grid gap-2">
              {preview.map((entry) => (
                <div key={entry.name} className="rounded border border-ui-border bg-ui-raised px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-ui-text">{entry.name}</span>
                    <span className="text-xs text-ui-text-mute">
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
