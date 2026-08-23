import { btnDanger, btnPrimary, btnSecondary } from "@/styles/buttonStyles";
import { useTournamentConfigurationPage } from "@/features/tournament/model/useTournamentConfigurationPage";
import { scoringSystemLabel } from "@/features/match/model/scoringSystem";

export default function ConfigurationPage() {
  const {
    form,
    setForm,
    scoringSystems,
    loading,
    saving,
    changingStatus,
    isClosed,
    isDirty,
    canSave,
    resetForm,
    handleSave,
    handleClose,
    handleReopen,
  } = useTournamentConfigurationPage();

  if (loading) {
    return <p className="text-sm text-ui-text-mute">Loading configuration...</p>;
  }

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
                  {scoringSystemLabel(system)}
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
              onClick={resetForm}
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
