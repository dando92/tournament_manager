import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { TournamentConfiguration } from "@/features/tournament/model/types";
import { rememberTournament } from "@/shared/lib/recentTournaments";
import {
  closeTournament,
  getTournamentConfiguration,
  reopenTournament,
  updateTournament,
} from "@/features/tournament/api/tournament.api";
import { listScoringSystems } from "@/features/match/api/match.api";
import { useTournamentPageContext } from "@/features/tournament/model/TournamentPageContext";

/**
 * The configuration form: what it holds, what it may save, and what closing
 * or reopening the tournament does to it.
 *
 * The form is kept as strings because that is what the inputs bind to; the
 * numbers are parsed once, at the point where they decide whether saving is
 * allowed.
 */

export type TournamentConfigurationForm = {
  name: string;
  syncstartUrl: string;
  startggApiKey: string;
  availableSetupsCount: string;
  defaultScoringSystem: string;
};

const emptyForm: TournamentConfigurationForm = {
  name: "",
  syncstartUrl: "",
  startggApiKey: "",
  availableSetupsCount: "2",
  defaultScoringSystem: "",
};

function toForm(configuration: TournamentConfiguration): TournamentConfigurationForm {
  return {
    name: configuration.name ?? "",
    syncstartUrl: configuration.syncstartUrl ?? "",
    startggApiKey: configuration.startggApiKey ?? "",
    availableSetupsCount: String(configuration.availableSetupsCount ?? 2),
    defaultScoringSystem: configuration.defaultScoringSystem ?? "",
  };
}

export function useTournamentConfigurationPage() {
  const {
    tournamentId,
    setTournamentName,
    setSyncstartUrl,
    setHasStartggApiKey,
    setTournamentStatus,
  } = useTournamentPageContext();
  const [initial, setInitial] = useState<TournamentConfigurationForm>(emptyForm);
  const [form, setForm] = useState<TournamentConfigurationForm>(emptyForm);
  const [scoringSystems, setScoringSystems] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configuration, setConfiguration] = useState<TournamentConfiguration | null>(null);
  const [changingStatus, setChangingStatus] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([getTournamentConfiguration(tournamentId), listScoringSystems()])
      .then(([loadedConfiguration, systems]) => {
        if (cancelled) return;
        const nextForm = toForm(loadedConfiguration);
        setConfiguration(loadedConfiguration);
        setTournamentStatus(loadedConfiguration.status);
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
  const isClosed = configuration?.status === "closed";
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
      await updateTournament(tournamentId, {
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
      rememberTournament({ id: tournamentId, name: saved.name });
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
      const closed = await closeTournament(tournamentId);
      setConfiguration((current) =>
        current ? { ...current, status: closed.status, closedAt: closed.closedAt } : current,
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
      const reopened = await reopenTournament(tournamentId);
      setConfiguration((current) =>
        current ? { ...current, status: reopened.status, closedAt: reopened.closedAt } : current,
      );
      setTournamentStatus("open");
      toast.success("Tournament reopened.");
    } catch {
      toast.error("Failed to reopen tournament.");
    } finally {
      setChangingStatus(false);
    }
  }

  return {
    form,
    setForm,
    scoringSystems,
    loading,
    saving,
    changingStatus,
    isClosed,
    isDirty,
    canSave,
    resetForm: () => setForm(initial),
    handleSave,
    handleClose,
    handleReopen,
  };
}
