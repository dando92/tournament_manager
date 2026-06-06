import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Division } from "@/features/division/types/Division";
import { PhaseGroup } from "@/features/division/types/Phase";
import EliminationMatchesView from "@/features/match/components/bracket/EliminationMatchesView";
import MatchCard from "@/features/match/components/MatchCard";
import RawMatchCardsView from "@/features/match/components/RawMatchCardsView";
import { useMatches } from "@/features/match/services/useMatches";
import * as MatchesApi from "@/features/match/services/matches.api";
import { Match, MatchHighlight, MatchState } from "@/features/match/types/Match";

type MatchListProps = {
  division: Division;
  controls?: boolean;
  tournamentId?: number;
  matchUpdateSignal?: number;
  phaseGroupId?: number;
  phaseGroup?: PhaseGroup;
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
  phaseGroup,
  matchStateFilter = "all",
  highlight,
  onHighlight,
}: MatchListProps) {
  const { state, actions } = useMatches(division.id, phaseGroupId);
  const [divisionMatches, setDivisionMatches] = useState<Match[] | null>(null);

  const allMatches = useMemo(() => {
    if (phaseGroupId === undefined) return state.matches;
    if (!divisionMatches) return state.matches;

    const matchesById = new Map(divisionMatches.map((match) => [match.id, match]));
    state.matches.forEach((match) => matchesById.set(match.id, match));
    return Array.from(matchesById.values());
  }, [divisionMatches, phaseGroupId, state.matches]);

  const visibleMatches = state.matches.filter((match) => {
    const matchState = match.state ?? "NotActive";
    if (matchStateFilter !== "all" && matchState !== matchStateFilter) return false;
    return true;
  });
  const phaseGroups = useMemo(
    () => (division.phases ?? []).flatMap((phase) => phase.phaseGroups ?? []),
    [division.phases],
  );
  const bracketType = phaseGroup?.bracketType ?? phaseGroups.find((candidate) => candidate.id === phaseGroupId)?.bracketType ?? null;
  const usesBracketTree = phaseGroupId !== undefined && isEliminationBracket(bracketType);

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

  const renderMatchCard = (match: Match, enablePathRowHighlight = false): ReactNode => (
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
      enablePathRowHighlight={enablePathRowHighlight}
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
  );

  return (
    <div className="mt-4">
      {visibleMatches.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-8">No matches yet.</p>
      ) : usesBracketTree ? (
        <EliminationMatchesView
          matches={visibleMatches}
          phaseGroups={phaseGroups}
          renderMatchCard={renderMatchCard}
        />
      ) : (
        <RawMatchCardsView
          matches={visibleMatches}
          renderMatchCard={(match) => renderMatchCard(match, true)}
        />
      )}
    </div>
  );
}

function isEliminationBracket(bracketType: string | null | undefined): boolean {
  return bracketType === "SingleElimination"
    || bracketType === "SINGLE_ELIMINATION"
    || bracketType === "DoubleElimination"
    || bracketType === "DOUBLE_ELIMINATION";
}
