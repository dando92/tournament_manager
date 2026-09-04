import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import { matchKeys } from "@/features/match/api/match.keys";
import { tournamentKeys } from "@/features/tournament/api/tournament.keys";
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
const noScoringSystems: string[] = [];

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
  const configurationQuery = useQuery({
    queryKey: tournamentKeys.configuration(tournamentId),
    queryFn: () => getTournamentConfiguration(tournamentId),
  });
  const scoringSystemsQuery = useQuery({
    queryKey: matchKeys.scoringSystems(),
    queryFn: listScoringSystems,
  });
  const saveMutation = useMutation({
    mutationFn: (details: TournamentConfigurationForm) => updateTournament(tournamentId, {
      name: details.name.trim(),
      syncstartUrl: details.syncstartUrl.trim(),
      startggApiKey: details.startggApiKey.trim() || null,
      availableSetupsCount: Number(details.availableSetupsCount),
      defaultScoringSystem: details.defaultScoringSystem,
    }),
  });
  const closeMutation = useMutation({ mutationFn: () => closeTournament(tournamentId) });
  const reopenMutation = useMutation({ mutationFn: () => reopenTournament(tournamentId) });
  const configuration = configurationQuery.data;
  const scoringSystems = scoringSystemsQuery.data ?? noScoringSystems;
  const loading = configurationQuery.isLoading || scoringSystemsQuery.isLoading;
  const saving = saveMutation.isPending;
  const changingStatus = closeMutation.isPending || reopenMutation.isPending;

  useEffect(() => {
    if (!configuration) return;

    const nextForm = toForm(configuration);
    if (!nextForm.defaultScoringSystem) nextForm.defaultScoringSystem = scoringSystems[0] ?? "";
    setInitial(nextForm);
    setForm(nextForm);
    setTournamentName(nextForm.name);
    setSyncstartUrl(nextForm.syncstartUrl);
    setHasStartggApiKey(Boolean(nextForm.startggApiKey));
    setTournamentStatus(configuration.status);
  }, [
    configuration,
    scoringSystems,
    setHasStartggApiKey,
    setSyncstartUrl,
    setTournamentName,
    setTournamentStatus,
  ]);

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

    try {
      await saveMutation.mutateAsync(form);
      rememberTournament({ id: tournamentId, name: form.name.trim() });
    } catch {
      toast.error("Failed to save tournament configuration.");
    }
  }

  async function handleClose() {
    if (!configuration || changingStatus) return;
    const confirmed = window.confirm(
      `Close this tournament? It will become read-only, active lobbies will be disconnected, and all transport data will be permanently deleted after ${configuration.transportRetentionDays} days.`,
    );
    if (!confirmed) return;
    try {
      await closeMutation.mutateAsync();
    } catch {
      toast.error("Failed to close tournament.");
    }
  }

  async function handleReopen() {
    if (!configuration || changingStatus) return;
    try {
      await reopenMutation.mutateAsync();
    } catch {
      toast.error("Failed to reopen tournament.");
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
