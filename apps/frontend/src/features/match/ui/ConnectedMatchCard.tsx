import MatchCard from "@/features/match/ui/MatchCard";
import { useAdvancementTargets } from "@/features/match/model/useAdvancementTargets";
import { useMatches } from "@/features/match/model/useMatches";
import { Division } from "@/features/division/model/types";
import { Entrant } from "@/features/participant/model/types";
import { Match, MatchHighlight } from "@/features/match/model/types";

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
  divisionEntrants: Entrant[];
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
  divisionEntrants,
  allMatches,
  actions,
  controls,
  tournamentId,
  highlight,
  onHighlight,
}: ConnectedMatchCardProps) {
  const loadAdvancementTargets = useAdvancementTargets(division.id);

  return (
    <MatchCard
      match={match}
      division={division}
      divisionEntrants={divisionEntrants}
      allMatches={allMatches}
      controls={controls}
      tournamentId={tournamentId}
      highlight={highlight}
      onHighlight={onHighlight}
      enablePathRowHighlight
      loadAdvancementTargets={loadAdvancementTargets}
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
