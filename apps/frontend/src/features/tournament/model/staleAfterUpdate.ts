import type { QueryKey } from "@tanstack/react-query";
import { matchKeys } from "@/features/match/api/match.keys";
import { divisionKeys } from "@/features/division/api/division.keys";
import { tournamentKeys } from "@/features/tournament/api/tournament.keys";

type TournamentUpdateMessage = {
  tournamentId: number;
};

type DivisionUpdateMessage = {
  tournamentId: number;
  divisionId: number;
};

type PhaseUpdateMessage = {
  tournamentId: number;
  divisionId: number;
  phaseId: number;
};

type PhaseGroupUpdateMessage = {
  tournamentId: number;
  divisionId: number;
  phaseId: number;
  phaseGroupId: number;
};

type MatchUpdateMessage = {
  tournamentId: number;
  divisionId: number;
  phaseId: number;
  phaseGroupId: number;
  matchId: number;
};

type UiWarningMessage = {
  tournamentId: number;
  message: string;
};

export type TournamentSocketMessage =
  | { event: "TournamentUpdate"; data: TournamentUpdateMessage }
  | { event: "DivisionUpdate"; data: DivisionUpdateMessage }
  | { event: "PhaseUpdate"; data: PhaseUpdateMessage }
  | { event: "PhaseGroupUpdate"; data: PhaseGroupUpdateMessage }
  | { event: "MatchUpdate"; data: MatchUpdateMessage }
  | { event: "UiWarning"; data: UiWarningMessage };

/**
 * What an event makes stale.
 *
 * Every message carries the address of what changed, so the reads it invalidates
 * are the ones scoped to that address and no others. A match event says one
 * pool's list of matches has moved and nothing about the tree: the counts the
 * tree draws change under their own event, which the server publishes only when
 * they actually did. Scoring a round used to re-read the division, the pool and
 * the whole tournament, which is why typing a percentage cost four requests.
 *
 * A warning makes nothing stale. It is a message to a person, not a change.
 */
export function staleAfterUpdate(message: TournamentSocketMessage): QueryKey[] {
  switch (message.event) {
    case "TournamentUpdate":
      return [tournamentKeys.overview(message.data.tournamentId)];
    case "DivisionUpdate":
      return [
        tournamentKeys.overview(message.data.tournamentId),
        divisionKeys.summary(message.data.divisionId),
        divisionKeys.entrants(message.data.divisionId),
      ];
    case "PhaseUpdate":
      return [
        tournamentKeys.overview(message.data.tournamentId),
        divisionKeys.summary(message.data.divisionId),
      ];
    case "PhaseGroupUpdate":
      return [
        tournamentKeys.overview(message.data.tournamentId),
        divisionKeys.summary(message.data.divisionId),
        matchKeys.byPhaseGroup(message.data.phaseGroupId),
        matchKeys.byDivision(message.data.divisionId),
      ];
    case "MatchUpdate":
      return [
        matchKeys.byPhaseGroup(message.data.phaseGroupId),
        matchKeys.byDivision(message.data.divisionId),
      ];
    default:
      return [];
  }
}
