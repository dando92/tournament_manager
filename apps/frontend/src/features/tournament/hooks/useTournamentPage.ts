import type { Dispatch, SetStateAction } from "react";
import { useEffect, useState } from "react";
import axios from "axios";
import { Tournament } from "@/features/tournament/types/Tournament";
import { rememberTournament } from "@/features/tournament/services/recentTournaments";

/**
 * The tournament's own properties: what it is called, where its lobbies
 * connect, whether it is open.
 *
 * Its structure — divisions, phases, pools — is not here. That belongs to
 * `TournamentTreeProvider`, which sits above the page so the sidebar can read
 * it too, and fetching it twice would mean two answers to the same question.
 */

type UseTournamentPageOptions = {
  tournamentId: number;
  canControl: boolean;
};

export type TournamentPageState = {
  tournamentName: string;
  syncstartUrl: string;
  hasStartggApiKey: boolean;
  tournamentStatus: "open" | "closed";
  setTournamentName: Dispatch<SetStateAction<string>>;
  setSyncstartUrl: Dispatch<SetStateAction<string>>;
  setHasStartggApiKey: Dispatch<SetStateAction<boolean>>;
  setTournamentStatus: Dispatch<SetStateAction<"open" | "closed">>;
};

export function useTournamentPage({ tournamentId, canControl }: UseTournamentPageOptions): TournamentPageState {
  const [tournamentName, setTournamentName] = useState("");
  const [syncstartUrl, setSyncstartUrl] = useState("");
  const [hasStartggApiKey, setHasStartggApiKey] = useState(false);
  const [tournamentStatus, setTournamentStatus] = useState<"open" | "closed">("open");

  useEffect(() => {
    axios
      .get<Tournament>(`tournaments/${tournamentId}`)
      .then((response) => {
        rememberTournament({ id: response.data.id, name: response.data.name });
        setTournamentName(response.data.name);
        setSyncstartUrl(response.data.syncstartUrl ?? "");
        setTournamentStatus(response.data.status);
        document.title = `${response.data.name} - Tournament Manager`;
      })
      .catch(() => {});

    if (canControl) {
      axios
        .get<{ hasStartggApiKey: boolean }>(`tournaments/${tournamentId}/startgg/api-key-status`)
        .then((response) => setHasStartggApiKey(response.data.hasStartggApiKey))
        .catch(() => setHasStartggApiKey(false));
    }

    return () => {
      document.title = "Tournament Manager";
    };
  }, [canControl, tournamentId]);

  return {
    tournamentName,
    syncstartUrl,
    hasStartggApiKey,
    tournamentStatus,
    setTournamentName,
    setSyncstartUrl,
    setHasStartggApiKey,
    setTournamentStatus,
  };
}
