import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { btnDanger, btnPrimary, btnSecondary } from "@/styles/buttonStyles";
import { useTournamentPageContext } from "@/features/tournament/context/TournamentPageContext";
import {
  Tournament,
  TournamentConfiguration,
} from "@/features/tournament/types/Tournament";
import { addRecentTournament } from "@/features/tournament/services/recentTournaments";

type FormState = {
  name: string;
  syncstartUrl: string;
  startggApiKey: string;
  availableSetupsCount: string;
  defaultScoringSystem: string;
};

const emptyForm: FormState = {
  name: "",
  syncstartUrl: "",
  startggApiKey: "",
  availableSetupsCount: "2",
  defaultScoringSystem: "",
};

function toForm(configuration: TournamentConfiguration): FormState {
  return {
    name: configuration.name ?? "",
    syncstartUrl: configuration.syncstartUrl ?? "",
    startggApiKey: configuration.startggApiKey ?? "",
    availableSetupsCount: String(configuration.availableSetupsCount ?? 2),
    defaultScoringSystem: configuration.defaultScoringSystem ?? "",
  };
}

export default function TournamentConfigurationPage() {
  const {
    tournamentId,
    setTournamentName,
    setSyncstartUrl,
    setHasStartggApiKey,
    setTournamentStatus,
  } = useTournamentPageContext();
  const [initial, setInitial] = useState<FormState>(emptyForm);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [scoringSystems, setScoringSystems] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configuration, setConfiguration] =
    useState<TournamentConfiguration | null>(null);
  const [changingStatus, setChangingStatus] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      axios.get<TournamentConfiguration>(
        `tournaments/${tournamentId}/configuration`,
      ),
      axios.get<string[]>("matches/scoring-systems"),
    ])
      .then(([configurationResponse, scoringSystemsResponse]) => {
        if (cancelled) return;
        const nextForm = toForm(configurationResponse.data);
        setConfiguration(configurationResponse.data);
        setTournamentStatus(configurationResponse.data.status);
        const systems = scoringSystemsResponse.data;
        setScoringSystems(systems);
        if (!nextForm.defaultScoringSystem) {
          nextForm.defaultScoringSystem = systems[0] ?? "";
        }
        setInitial(nextForm);
        setForm(nextForm);
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load tournament configuration.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [setTournamentStatus, tournamentId]);

  const isDirty = useMemo(
    () =>
      form.name !== initial.name ||
      form.syncstartUrl !== initial.syncstartUrl ||
      form.startggApiKey !== initial.startggApiKey ||
      form.availableSetupsCount !== initial.availableSetupsCount ||
      form.defaultScoringSystem !== initial.defaultScoringSystem,
    [form, initial],
  );

  const parsedAvailableSetupsCount = Number(form.availableSetupsCount);
  const canSave =
    configuration?.status === "open" &&
    isDirty &&
    !saving &&
    Number.isInteger(parsedAvailableSetupsCount) &&
    parsedAvailableSetupsCount >= 0 &&
    Boolean(form.name.trim()) &&
    Boolean(form.defaultScoringSystem);

  async function handleSave() {
    if (!canSave) return;

    setSaving(true);
    try {
      await axios.patch(`tournaments/${tournamentId}`, {
        name: form.name.trim(),
        syncstartUrl: form.syncstartUrl.trim(),
        startggApiKey: form.startggApiKey.trim() || null,
        availableSetupsCount: parsedAvailableSetupsCount,
        defaultScoringSystem: form.defaultScoringSystem,
      });
      const saved = {
        ...form,
        name: form.name.trim(),
        syncstartUrl: form.syncstartUrl.trim(),
        startggApiKey: form.startggApiKey.trim(),
        availableSetupsCount: String(parsedAvailableSetupsCount),
      };
      setInitial(saved);
      setForm(saved);
      setTournamentName(saved.name);
      addRecentTournament({ id: tournamentId, name: saved.name });
      setSyncstartUrl(saved.syncstartUrl);
      setHasStartggApiKey(Boolean(saved.startggApiKey));
      toast.success("Configuration saved.");
    } catch {
      toast.error("Failed to save tournament configuration.");
    } finally {
      setSaving(false);
    }
  }

  async function handleClose() {
    if (!configuration || changingStatus) return;
    const confirmed = window.confirm(
      `Close this tournament? It will become read-only, active lobbies will be disconnected, and all transport data will be permanently deleted after ${configuration.transportRetentionDays} days.`,
    );
    if (!confirmed) return;
    setChangingStatus(true);
    try {
      const response = await axios.post<Tournament>(
        `tournaments/${tournamentId}/close`,
      );
      setConfiguration((current) =>
        current
          ? {
              ...current,
              status: response.data.status,
              closedAt: response.data.closedAt,
            }
          : current,
      );
      setTournamentStatus("closed");
      toast.success("Tournament closed. It is now read-only.");
    } catch {
      toast.error("Failed to close tournament.");
    } finally {
      setChangingStatus(false);
    }
  }

  async function handleReopen() {
    if (!configuration || changingStatus) return;
    setChangingStatus(true);
    try {
      const response = await axios.post<Tournament>(
        `tournaments/${tournamentId}/reopen`,
      );
      setConfiguration((current) =>
        current
          ? {
              ...current,
              status: response.data.status,
              closedAt: response.data.closedAt,
            }
          : current,
      );
      setTournamentStatus("open");
      toast.success("Tournament reopened.");
    } catch {
      toast.error("Failed to reopen tournament.");
    } finally {
      setChangingStatus(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-ui-text-mute">Loading configuration...</p>;
  }

  const isClosed = configuration?.status === "closed";

  return (
    <div className="max-w-3xl">
      <div className="rounded-xl border border-ui-border bg-ui-surface p-5 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-bold text-ui-text">Configuration</h2>
          <p className="text-sm text-ui-text-mute">
            Tournament-wide integration and match defaults.
          </p>
        </div>

        {isClosed && (
          <div className="mb-5 rounded-lg border border-state-pending/30 bg-state-pending/10 px-4 py-3 text-sm text-ui-text-soft">
            This tournament is closed and read-only. Reopen it before making
            changes.
          </div>
        )}

        <div className="grid gap-4">
          <label className="grid gap-1">
            <span className="text-sm font-semibold text-ui-text">
              Tournament name
            </span>
            <input
              type="text"
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              className="rounded border border-ui-border-strong px-3 py-2 text-sm"
              placeholder="Tournament name"
              disabled={isClosed}
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-semibold text-ui-text">
              SyncStart URL
            </span>
            <input
              type="text"
              value={form.syncstartUrl}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  syncstartUrl: event.target.value,
                }))
              }
              className="rounded border border-ui-border-strong px-3 py-2 text-sm"
              placeholder="ws://syncservice.groovestats.com:1337"
              disabled={isClosed}
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-semibold text-ui-text">
              start.gg API key
            </span>
            <input
              type="password"
              value={form.startggApiKey}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  startggApiKey: event.target.value,
                }))
              }
              className="rounded border border-ui-border-strong px-3 py-2 text-sm"
              placeholder="Paste tournament start.gg API key"
              autoComplete="off"
              disabled={isClosed}
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-semibold text-ui-text">
              Available setups count
            </span>
            <input
              type="number"
              min={0}
              step={1}
              value={form.availableSetupsCount}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  availableSetupsCount: event.target.value,
                }))
              }
              className="rounded border border-ui-border-strong px-3 py-2 text-sm"
              disabled={isClosed}
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-semibold text-ui-text">
              Default match scoring system
            </span>
            <select
              value={form.defaultScoringSystem}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  defaultScoringSystem: event.target.value,
                }))
              }
              className="rounded border border-ui-border-strong px-3 py-2 text-sm"
              disabled={isClosed}
            >
              {scoringSystems.map((system) => (
                <option key={system} value={system}>
                  {system}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6 flex flex-wrap justify-between gap-2">
          {isClosed ? (
            <button
              type="button"
              onClick={handleReopen}
              disabled={changingStatus}
              className={`${btnPrimary} text-sm`}
            >
              {changingStatus ? "Reopening..." : "Reopen tournament"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleClose}
              disabled={changingStatus || saving}
              className={`${btnDanger} text-sm`}
            >
              {changingStatus ? "Closing..." : "Close tournament"}
            </button>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setForm(initial)}
              disabled={!isDirty || saving}
              className={`${btnSecondary} text-sm disabled:cursor-not-allowed disabled:opacity-50`}
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className={`${btnPrimary} text-sm disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
