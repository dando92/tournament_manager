import type { Dispatch, SetStateAction } from "react";
import { useEffect, useState } from "react";
import { getTournament, hasStartggApiKey as loadHasStartggApiKey } from "@/features/tournament/api/tournament.api";
import { rememberTournament } from "@/shared/lib/recentTournaments";

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

  /* The tournament itself does not depend on who is looking at it, so it is
     read on its own. Kept in the same effect as the key check below it was
     fetched a second time the moment permissions resolved and `canControl`
     flipped. */
  useEffect(() => {
    getTournament(tournamentId)
      .then((tournament) => {
        rememberTournament({ id: tournament.id, name: tournament.name });
        setTournamentName(tournament.name);
        setSyncstartUrl(tournament.syncstartUrl ?? "");
        setTournamentStatus(tournament.status);
        document.title = `${tournament.name} - Tournament Manager`;
      })
      .catch(() => {});

    return () => {
      document.title = "Tournament Manager";
    };
  }, [tournamentId]);

  useEffect(() => {
    if (!canControl) return;
    loadHasStartggApiKey(tournamentId)
      .then(setHasStartggApiKey)
      .catch(() => setHasStartggApiKey(false));
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
