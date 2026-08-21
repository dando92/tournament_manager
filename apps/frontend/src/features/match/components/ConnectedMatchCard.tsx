import { useQueryClient } from "@tanstack/react-query";
import MatchCard from "@/features/match/components/MatchCard";
import * as MatchesApi from "@/features/match/services/matches.api";
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
          queryKey: ["matches", "division", division.id],
          queryFn: () => MatchesApi.listByDivision(division.id),
        })
      }
      onMatchUpdated={actions.list}
      onEditMatchNotes={actions.editMatchNotes}
      onRenameMatch={actions.renameMatch}
      onDeleteMatch={actions.deleteMatch}
      onAddPlayersToMatch={(entrantIds) => actions.updateMatchEntrants(match.id, entrantIds)}
      onAddSongToMatchByRoll={(group, level) => actions.addSongToMatchByRoll(match.id, division.id, group, level)}
      onAddSongToMatchBySongId={(songId) => actions.addSongToMatchBySongId(match.id, songId)}
      onEditSongToMatchByRoll={(group, level, editSongId) =>
        actions.editSongToMatchByRoll(match.id, editSongId, division.id, group, level)
      }
      onEditSongToMatchBySongId={(songId, editSongId) =>
        actions.editSongToMatchBySongId(match.id, editSongId, songId)
      }
      onDeleteSongFromMatch={(songId) => actions.deleteSongFromMatch(match.id, songId)}
      onAddStandingToMatch={(playerId, songId, percentage, score, failed, scoreId) =>
        actions.addStandingToMatch(match.id, playerId, songId, percentage, score, failed, scoreId)
      }
      onEditStanding={(playerId, songId, percentage, score, failed, scoreId) =>
        actions.editStandingFromMatch(match.id, songId, playerId, percentage, score, failed, scoreId)
      }
      onDeleteStanding={(playerId, songId) =>
        actions.deleteStandingsForPlayerFromMatch(match.id, playerId, songId)
      }
      onUpdateMatchAdvancementRules={actions.updateMatchAdvancementRules}
      onUpdateMatchActive={actions.updateMatchActive}
      onCommitMatchResult={actions.commitMatchResult}
      onReopenMatchResult={actions.reopenMatchResult}
    />
  );
}
