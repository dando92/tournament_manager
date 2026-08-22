import { useQueryClient } from "@tanstack/react-query";
import MatchCard from "@/features/match/components/MatchCard";
import * as MatchesApi from "@/features/match/services/matches.api";
import { matchKeys } from "@/features/match/services/matches.keys";
import { useMatches } from "@/features/match/services/useMatches";
import { Division } from "@/features/division/types/Division";
import { Match, MatchHighlight } from "@/features/match/types/Match";

/**
 * A match card wired to the division's match actions.
 *
 * The wiring is twenty callbacks long and was previously inlined in the list
 * that rendered every card. Now that one card is open at a time it lives here,
 * so the list is about listing and the card is about the match.
 */

type ConnectedMatchCardProps = {
  match: Match;
  division: Division;
  allMatches: Match[];
  actions: ReturnType<typeof useMatches>["actions"];
  controls: boolean;
  tournamentId?: number;
  highlight: MatchHighlight;
  onHighlight: (highlight: MatchHighlight) => void;
};

export default function ConnectedMatchCard({
  match,
  division,
  allMatches,
  actions,
  controls,
  tournamentId,
  highlight,
  onHighlight,
}: ConnectedMatchCardProps) {
  const queryClient = useQueryClient();

  return (
    <MatchCard
      match={match}
      division={division}
      allMatches={allMatches}
      controls={controls}
      tournamentId={tournamentId}
      highlight={highlight}
      onHighlight={onHighlight}
      enablePathRowHighlight
      loadAdvancementTargets={() =>
        queryClient.fetchQuery({
          queryKey: matchKeys.byDivision(division.id),
          queryFn: () => MatchesApi.listByDivision(division.id),
        })
      }
      onMatchUpdated={actions.list}
      onEditMatchNotes={actions.editMatchNotes}
      onRenameMatch={actions.renameMatch}
      onDeleteMatch={actions.deleteMatch}
      onAddPlayersToMatch={(entrantIds) => actions.updateMatchEntrants(match.id, entrantIds)}
      onAddRounds={(sources) => sources.forEach((source) => actions.addRound(match.id, source))}
      onReplaceRoundSong={actions.replaceRoundSong}
      onDeleteRound={actions.deleteRound}
      onAddHandScoredRound={() => actions.addRound(match.id)}
      onChangePoints={actions.savePoints}
      onAddStandingToMatch={(playerId, roundId, percentage, _score, isFailed, scoreId) =>
        actions.saveScore(playerId, roundId, { percentage, isFailed, scoreId })
      }
      onEditStanding={(playerId, roundId, percentage, _score, isFailed, scoreId) =>
        actions.saveScore(playerId, roundId, { percentage, isFailed, scoreId })
      }
      onDeleteStanding={actions.deleteStanding}
      onUpdateMatchAdvancementRules={actions.updateMatchAdvancementRules}
      onUpdateMatchActive={actions.updateMatchActive}
      onReopenMatchResult={actions.reopenMatchResult}
    />
  );
}
