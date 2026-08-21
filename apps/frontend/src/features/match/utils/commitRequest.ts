import { entrantPlayers } from "@/features/entrant/types/Entrant";
import { Match } from "@/features/match/types/Match";
import { CommitMatchResultRequest } from "@/features/match/types/match-requests";
import { effectiveManualPoints, type ManualScoring } from "@/features/match/services/manualScoring";

/**
 * What a commit sends.
 *
 * A match scored by songs needs nothing: the server already holds every
 * standing. A hand-scored one has to carry the draft, which until this moment
 * existed only on this device. Both the list row and the card commit, so the
 * shape of that request is decided once.
 */
export function buildCommitRequest(match: Match, manualScoring: ManualScoring): CommitMatchResultRequest {
  if (match.rounds.length > 0) return {};

  const points = effectiveManualPoints(manualScoring);
  return {
    playerPoints: entrantPlayers(match.entrants).map((player) => ({
      playerId: player.id,
      points: points[player.id] ?? 0,
    })),
  };
}
