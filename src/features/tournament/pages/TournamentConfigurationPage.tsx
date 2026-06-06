import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { btnPrimary, btnSecondary } from "@/styles/buttonStyles";
import { useTournamentPageContext } from "@/features/tournament/context/TournamentPageContext";
import { TournamentConfiguration } from "@/features/tournament/types/Tournament";
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
  const { tournamentId, setTournamentName, setSyncstartUrl, setHasStartggApiKey } = useTournamentPageContext();
  const [initial, setInitial] = useState<FormState>(emptyForm);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [scoringSystems, setScoringSystems] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      axios.get<TournamentConfiguration>(`tournaments/${tournamentId}/configuration`),
      axios.get<string[]>("matches/scoring-systems"),
    ])
      .then(([configurationResponse, scoringSystemsResponse]) => {
        if (cancelled) return;
        const nextForm = toForm(configurationResponse.data);
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
  }, [tournamentId]);

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

  if (loading) {
    return <p className="text-sm text-gray-500">Loading configuration...</p>;
  }

  return (
    <div className="max-w-3xl">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-bold text-gray-900">Configuration</h2>
          <p className="text-sm text-gray-500">Tournament-wide integration and match defaults.</p>
        </div>

        <div className="grid gap-4">
          <label className="grid gap-1">
            <span className="text-sm font-semibold text-gray-800">Tournament name</span>
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className="rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder="Tournament name"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-semibold text-gray-800">SyncStart URL</span>
            <input
              type="text"
              value={form.syncstartUrl}
              onChange={(event) => setForm((current) => ({ ...current, syncstartUrl: event.target.value }))}
              className="rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder="ws://syncservice.groovestats.com:1337"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-semibold text-gray-800">start.gg API key</span>
            <input
              type="password"
              value={form.startggApiKey}
              onChange={(event) => setForm((current) => ({ ...current, startggApiKey: event.target.value }))}
              className="rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder="Paste tournament start.gg API key"
              autoComplete="off"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-semibold text-gray-800">Available setups count</span>
            <input
              type="number"
              min={0}
              step={1}
              value={form.availableSetupsCount}
              onChange={(event) => setForm((current) => ({ ...current, availableSetupsCount: event.target.value }))}
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-semibold text-gray-800">Default match scoring system</span>
            <select
              value={form.defaultScoringSystem}
              onChange={(event) => setForm((current) => ({ ...current, defaultScoringSystem: event.target.value }))}
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            >
              {scoringSystems.map((system) => (
                <option key={system} value={system}>
                  {system}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
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
  );
}
