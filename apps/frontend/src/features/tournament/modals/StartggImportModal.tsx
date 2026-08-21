import { useEffect, useState } from "react";
import { StatusBadge } from "@/shared/components/ui/StatusIcon";
import type { Status } from "@/shared/components/ui/status";
import { toast } from "react-toastify";
import BaseModal from "@/shared/components/ui/BaseModal";
import { btnPrimary, btnSecondary } from "@/styles/buttonStyles";
import {
  importStartggEvent,
  previewStartggImport,
} from "@/features/tournament/services/startgg.api";
import { StartggImportPreviewResponse } from "@/features/tournament/types/StartggImport";

type Props = {
  open: boolean;
  onClose: () => void;
  fixedTournamentId?: number;
  fixedTournamentName?: string;
  onImported?: (result: { tournamentId: number; divisionId: number }) => Promise<void> | void;
};

const ACTION_LABELS: Record<string, string> = {
  mapped: "Mapped",
  "match-existing-participant": "Match existing participant",
  "create-participant": "Create participant",
  "create-player-and-participant": "Create player + participant",
  "match-existing-entrant": "Match existing entrant",
  "create-entrant": "Create entrant",
  "create-team-entrant": "Create team entrant",
  "create-phase": "Create phase",
  "create-match": "Create match",
  "create-division": "Create division",
  "unscoped-preview": "Preview only",
};

function formatAction(action: string) {
  return ACTION_LABELS[action] ?? action;
}

/** What the import did to a row, told by the same glyph the rest of the app uses. */
function actionStatus(action: string): Status {
  if (action === "mapped" || action.startsWith("match-")) return "done";
  if (action.startsWith("create")) return "running";
  if (action.includes("blocked")) return "failed";
  return "idle";
}

function ActionBadge({ action }: { action: string }) {
  return (
    <StatusBadge status={actionStatus(action)} label={formatAction(action)} />
  );
}

export default function StartggImportModal({
  open,
  onClose,
  fixedTournamentId,
  fixedTournamentName,
  onImported,
}: Props) {
  const [eventSlug, setEventSlug] = useState("");
  const [preview, setPreview] = useState<StartggImportPreviewResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setEventSlug("");
      return;
    }
  }, [fixedTournamentId, open]);

  useEffect(() => {
    setPreview(null);
  }, [eventSlug]);

  async function handlePreview() {
    if (!eventSlug.trim() || !fixedTournamentId) return;

    setLoadingPreview(true);
    try {
      const response = await previewStartggImport(fixedTournamentId, { eventSlug: eventSlug.trim(), mode: "create-division" });
      setPreview(response);
    } catch {
      toast.error("Failed to preview start.gg import.");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleImport() {
    if (!eventSlug.trim() || !fixedTournamentId) return;

    setSubmitting(true);
    try {
      const response = await importStartggEvent(fixedTournamentId, { eventSlug: eventSlug.trim(), mode: "create-division" });
      toast.success("start.gg import completed.");
      await onImported?.({ tournamentId: response.tournamentId, divisionId: response.divisionId });
      onClose();
    } catch {
      toast.error("Failed to import from start.gg.");
    } finally {
      setSubmitting(false);
    }
  }

  const footer = (
    <div className="flex items-center justify-between gap-3">
      <button type="button" onClick={handlePreview} disabled={loadingPreview || !eventSlug.trim()} className={`${btnSecondary} text-sm`}>
        {loadingPreview ? "Previewing..." : "Preview"}
      </button>
      <div className="flex gap-2">
        <button type="button" onClick={onClose} className={`${btnSecondary} text-sm`}>
          Cancel
        </button>
        <button
          type="button"
          onClick={handleImport}
          disabled={submitting || !preview || !fixedTournamentId}
          className={`${btnPrimary} text-sm`}
        >
          {submitting ? "Importing..." : "Confirm import"}
        </button>
      </div>
    </div>
  );

  return (
    <BaseModal open={open} onClose={onClose} title="Import from start.gg" maxWidth="max-w-4xl" footer={footer}>
      <div className="flex flex-col gap-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-ui-text">Event slug</label>
            <input
              value={eventSlug}
              onChange={(event) => setEventSlug(event.target.value)}
              placeholder="tournament/example/event/singles"
              autoFocus
              className="w-full rounded border border-ui-border-strong px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-state-running"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-ui-text">Target tournament</label>
            <div className="rounded border border-ui-border bg-ui-raised px-3 py-2 text-sm text-ui-text-soft">
              {fixedTournamentName ?? `Tournament #${fixedTournamentId}`}
            </div>
          </div>
        </div>

        {preview && (
          <div className="flex flex-col gap-4">
            <div className="rounded border border-ui-border bg-ui-raised p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ui-text-mute">Event</p>
                  <h3 className="text-lg font-semibold text-ui-text">{preview.event.name}</h3>
                  <p className="text-sm text-ui-text-mute">{preview.event.slug}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm text-ui-text-soft">
                  <span>Participants: {preview.counts.participants}</span>
                  <span>Entrants: {preview.counts.entrants}</span>
                  <span>Phases: {preview.counts.phases}</span>
                  <span>Matches: {preview.counts.matches}</span>
                </div>
              </div>
            </div>

            <section className="rounded border border-ui-border p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h4 className="font-semibold text-ui-text">Division</h4>
                  <p className="text-sm text-ui-text-mute">Local division target for this event import.</p>
                </div>
                <ActionBadge action={preview.division.action} />
              </div>
              <p className="text-sm text-ui-text">{preview.division.name}</p>
            </section>

            <section className="rounded border border-ui-border p-4">
              <div className="mb-3">
                <h4 className="font-semibold text-ui-text">Participants</h4>
                <p className="text-sm text-ui-text-mute">How each imported player identity will resolve locally.</p>
              </div>
              <div className="grid gap-2">
                {preview.participants.map((participant) => (
                  <div key={participant.externalId} className="flex items-center justify-between gap-3 rounded bg-ui-raised px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium text-ui-text">{participant.gamerTag}</p>
                      <p className="text-xs text-ui-text-mute">start.gg participant {participant.externalId}</p>
                    </div>
                    <ActionBadge action={participant.action} />
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded border border-ui-border p-4">
              <div className="mb-3">
                <h4 className="font-semibold text-ui-text">Entrants and seeding</h4>
                <p className="text-sm text-ui-text-mute">Event entrants, including singles and team cases.</p>
              </div>
              <div className="grid gap-2">
                {preview.entrants.map((entrant) => (
                  <div key={entrant.externalId} className="flex items-center justify-between gap-3 rounded bg-ui-raised px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium text-ui-text">{entrant.name}</p>
                      <p className="text-xs text-ui-text-mute">
                        {entrant.type} entrant
                        {entrant.seedNum !== null ? ` • seed ${entrant.seedNum}` : ""}
                      </p>
                    </div>
                    <ActionBadge action={entrant.action} />
                  </div>
                ))}
              </div>
            </section>

            <div className="grid gap-4 md:grid-cols-2">
              <section className="rounded border border-ui-border p-4">
                <div className="mb-3">
                  <h4 className="font-semibold text-ui-text">Phases</h4>
                  <p className="text-sm text-ui-text-mute">Phase structure to create or reuse.</p>
                </div>
                <div className="grid gap-2">
                  {preview.phases.map((phase) => (
                    <div key={phase.externalId} className="flex items-center justify-between gap-3 rounded bg-ui-raised px-3 py-2 text-sm">
                      <span className="font-medium text-ui-text">{phase.name}</span>
                      <ActionBadge action={phase.action} />
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded border border-ui-border p-4">
                <div className="mb-3">
                  <h4 className="font-semibold text-ui-text">Matches</h4>
                  <p className="text-sm text-ui-text-mute">Imported sets that will become local matches.</p>
                </div>
                <div className="grid gap-2">
                  {preview.matches.slice(0, 12).map((match) => (
                    <div key={match.externalId} className="flex items-center justify-between gap-3 rounded bg-ui-raised px-3 py-2 text-sm">
                      <span className="font-medium text-ui-text">{match.name}</span>
                      <ActionBadge action={match.action} />
                    </div>
                  ))}
                  {preview.matches.length > 12 && (
                    <p className="text-xs text-ui-text-mute">Showing 12 of {preview.matches.length} matches in preview.</p>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </BaseModal>
  );
}
