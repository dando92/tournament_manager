import { useEffect, useMemo, useState } from "react";
import { Division } from "@/features/division/types/Division";
import MatchCard from "@/features/match/components/MatchCard";
import { useMatches } from "@/features/match/services/useMatches";
import * as MatchesApi from "@/features/match/services/matches.api";
import { Match, MatchHighlight, MatchState } from "@/features/match/types/Match";

type MatchListProps = {
  division: Division;
  controls?: boolean;
  tournamentId?: number;
  matchUpdateSignal?: number;
  phaseGroupId?: number;
  matchStateFilter?: MatchState | "all";
  highlight: MatchHighlight;
  onHighlight: (highlight: MatchHighlight) => void;
};

export default function MatchList({
  division,
  controls = false,
  tournamentId,
  matchUpdateSignal,
  phaseGroupId,
  matchStateFilter = "all",
  highlight,
  onHighlight,
}: MatchListProps) {
  const { state, actions } = useMatches(division.id, phaseGroupId);
  const [divisionMatches, setDivisionMatches] = useState<Match[] | null>(null);

  const allMatches = useMemo(
    () => (phaseGroupId !== undefined ? divisionMatches ?? state.matches : state.matches),
    [divisionMatches, phaseGroupId, state.matches],
  );

  const visibleMatches = state.matches.filter((match) => {
    const matchState = match.state ?? "NotActive";
    if (matchStateFilter !== "all" && matchState !== matchStateFilter) return false;
    return true;
  });

  useEffect(() => {
    if (!matchUpdateSignal) return;
    actions.list();
    if (phaseGroupId !== undefined) {
      MatchesApi.listByDivision(division.id).then(setDivisionMatches).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchUpdateSignal]);

  useEffect(() => {
    if (phaseGroupId === undefined) {
      setDivisionMatches(null);
      return;
    }
    MatchesApi.listByDivision(division.id).then(setDivisionMatches).catch(() => setDivisionMatches(null));
  }, [division.id, phaseGroupId]);

  const refreshMatches = () => {
    actions.list();
    if (phaseGroupId !== undefined) {
      MatchesApi.listByDivision(division.id).then(setDivisionMatches).catch(() => {});
    }
  };

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
              allMatches={allMatches}
              loadAdvancementTargets={phaseGroupId !== undefined ? () => MatchesApi.listByDivision(division.id) : undefined}
              tournamentId={tournamentId}
              matchUpdateSignal={matchUpdateSignal}
              highlight={highlight}
              onHighlight={onHighlight}
              onDeleteStanding={(playerId, songId) =>
                actions.deleteStandingsForPlayerFromMatch(match.id, playerId, songId)
              }
              onMatchUpdated={refreshMatches}
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
