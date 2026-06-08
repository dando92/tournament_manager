import { createContext, ReactNode, useContext } from "react";
import { useTournamentUpdates } from "@/features/tournament/context/TournamentUpdatesContext";
import { useTournamentLobbiesPage } from "@/features/tournament/hooks/useTournamentLobbiesPage";

type TournamentLobbiesContextValue = ReturnType<typeof useTournamentLobbiesPage>;

const TournamentLobbiesContext = createContext<TournamentLobbiesContextValue | null>(null);

type Props = {
  tournamentId: number;
  children: ReactNode;
};

export function TournamentLobbiesProvider({ tournamentId, children }: Props) {
  const { activeLobbies, syncStartConnectionStatus, lobbyCardStates } = useTournamentUpdates();
  const value = useTournamentLobbiesPage({
    tournamentId,
    activeLobbies,
    syncStartConnectionStatus,
    lobbyCardStates,
  });

  return (
    <TournamentLobbiesContext.Provider value={value}>
      {children}
    </TournamentLobbiesContext.Provider>
  );
}

export function useTournamentLobbiesContext() {
  const context = useContext(TournamentLobbiesContext);
  if (!context) {
    throw new Error("useTournamentLobbiesContext must be used inside TournamentLobbiesProvider");
  }
  return context;
}
