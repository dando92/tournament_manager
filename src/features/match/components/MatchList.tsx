import { useEffect, useState } from "react";
import { Division } from "@/features/division/types/Division";
import MatchCard from "@/features/match/components/MatchCard";
import { useMatches } from "@/features/match/services/useMatches";
import * as MatchesApi from "@/features/match/services/matches.api";
import { MatchState } from "@/features/match/types/Match";

type MatchListProps = {
  division: Division;
  controls?: boolean;
  tournamentId?: number;
  matchUpdateSignal?: number;
  phaseGroupId?: number;
  matchStateFilter?: MatchState | "all";
};

export default function MatchList({
  division,
  controls = false,
  tournamentId,
  matchUpdateSignal,
  phaseGroupId,
  matchStateFilter = "all",
}: MatchListProps) {
  const { state, actions } = useMatches(division.id, phaseGroupId);
  const [highlightedMatchId, setHighlightedMatchId] = useState<number | null>(null);

  const visibleMatches = state.matches.filter((match) => {
    const matchState = match.state ?? "NotActive";
    if (matchStateFilter !== "all" && matchState !== matchStateFilter) return false;
    return true;
  });

  useEffect(() => {
    if (!matchUpdateSignal) return;
    actions.list();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchUpdateSignal]);

  return (
    <div className="mt-4">
      {visibleMatches.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-8">No matches yet.</p>
      ) : (
        <div>
          {[...visibleMatches].sort((a, b) => a.id - b.id).map((match) => (
            <MatchCard
              key={match.id}
              controls={controls}
              division={division}
              allMatches={state.matches}
              loadAdvancementTargets={phaseGroupId !== undefined ? () => MatchesApi.listByDivision(division.id) : undefined}
              tournamentId={tournamentId}
              matchUpdateSignal={matchUpdateSignal}
              highlightedMatchId={highlightedMatchId}
              onHighlightMatch={setHighlightedMatchId}
              onDeleteStanding={(playerId, songId) =>
                actions.deleteStandingsForPlayerFromMatch(match.id, playerId, songId)
              }
              onMatchUpdated={actions.list}
              onEditMatchNotes={actions.editMatchNotes}
              onRenameMatch={actions.renameMatch}
              onDeleteMatch={actions.deleteMatch}
              onAddPlayersToMatch={(entrantIds) =>
                actions.updateMatchEntrants(match.id, entrantIds)
              }
              onAddSongToMatchByRoll={(group, level) =>
                actions.addSongToMatchByRoll(match.id, division.id, group, level)
              }
              onAddSongToMatchBySongId={(songId) =>
                actions.addSongToMatchBySongId(match.id, songId)
              }
              onEditSongToMatchByRoll={(group, level, editSongId) =>
                actions.editSongToMatchByRoll(match.id, editSongId, division.id, group, level)
              }
              onEditSongToMatchBySongId={(songId, editSongId) =>
                actions.editSongToMatchBySongId(match.id, editSongId, songId)
              }
              onDeleteSongFromMatch={(songId) =>
                actions.deleteSongFromMatch(match.id, songId)
              }
              onAddStandingToMatch={(playerId, songId, pct, sc, fail, scoreId) =>
                actions.addStandingToMatch(match.id, playerId, songId, pct, sc, fail, scoreId)
              }
              onEditStanding={(playerId, songId, pct, sc, fail, scoreId) =>
                actions.editStandingFromMatch(match.id, songId, playerId, pct, sc, fail, scoreId)
              }
              onUpdateMatchAdvancementRules={actions.updateMatchAdvancementRules}
              onUpdateMatchState={actions.updateMatchState}
              onRefreshSelf={() => actions.refreshMatch(match.id)}
              match={match}
            />
          ))}
        </div>
      )}
    </div>
  );
}
