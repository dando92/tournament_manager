import { useMemo, type ReactNode } from "react";
import { Division } from "@/features/division/types/Division";
import { PoolViewMode } from "@/features/division/services/poolViewMode";
import { PhaseGroup } from "@/features/division/types/Phase";
import EliminationMatchesView from "@/features/match/components/bracket/EliminationMatchesView";
import MatchCard from "@/features/match/components/MatchCard";
import RawMatchCardsView from "@/features/match/components/RawMatchCardsView";
import RoundRobinMatchesView from "@/features/match/components/round-robin/RoundRobinMatchesView";
import { useMatches } from "@/features/match/services/useMatches";
import * as MatchesApi from "@/features/match/services/matches.api";
import { Match, MatchHighlight } from "@/features/match/types/Match";
import { useQueryClient } from "@tanstack/react-query";
import CreateCard from "@/shared/components/ui/CreateCard";

type MatchListProps = {
  division: Division;
  controls?: boolean;
  tournamentId?: number;
  phaseGroupId?: number;
  phaseGroup?: PhaseGroup;
  viewMode: PoolViewMode;
  highlight: MatchHighlight;
  onHighlight: (highlight: MatchHighlight) => void;
  onCreateMatch?: () => void;
};

export default function MatchList({
  division,
  controls = false,
  tournamentId,
  phaseGroupId,
  phaseGroup,
  viewMode,
  highlight,
  onHighlight,
  onCreateMatch,
}: MatchListProps) {
  const { state, actions } = useMatches(division.id, phaseGroupId);
  const queryClient = useQueryClient();
  const allMatches = state.matches;

  const phaseGroups = useMemo(
    () => (division.phases ?? []).flatMap((phase) => phase.phaseGroups ?? []),
    [division.phases],
  );
  const hasBracketEdges = useMemo(
    () => {
      const matchIds = new Set(state.matches.map((match) => match.id));
      return state.matches.some((match) =>
        (match.advancementRules ?? []).some(
          (rule) => rule.sourceKind === "match" && rule.targetKind === "match" && matchIds.has(rule.targetId),
        ),
      );
    },
    [state.matches],
  );
  const usesBracketTree = viewMode === "bracket" && hasBracketEdges;
  const bracketTreeUnavailable = viewMode === "bracket" && !hasBracketEdges;
  const usesRoundRobinTable = viewMode === "roundRobin";

  const refreshMatches = () => {
    actions.list();
  };

  const renderMatchCard = (match: Match, enablePathRowHighlight = false): ReactNode => (
    <MatchCard
      key={match.id}
      controls={controls}
      division={division}
      allMatches={allMatches}
      loadAdvancementTargets={
        phaseGroupId !== undefined
          ? () => queryClient.fetchQuery({
              queryKey: ["matches", "division", division.id],
              queryFn: () => MatchesApi.listByDivision(division.id),
            })
          : undefined
      }
      tournamentId={tournamentId}
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
      onUpdateMatchActive={actions.updateMatchActive}
      onCommitMatchResult={actions.commitMatchResult}
      onReopenMatchResult={actions.reopenMatchResult}
      match={match}
    />
  );

  return (
    <div className="mt-4">
      {state.matches.length === 0 ? (
        onCreateMatch ? (
          <CreateCard label="Create match" onClick={onCreateMatch} />
        ) : (
          <p className="text-center text-gray-500 text-sm py-8">No matches yet.</p>
        )
      ) : usesRoundRobinTable ? (
        <>
          <RoundRobinMatchesView
            matches={state.matches}
            phaseGroup={phaseGroup}
            renderMatchCard={(match) => renderMatchCard(match, true)}
          />
          {onCreateMatch && <CreateCard label="Create match" onClick={onCreateMatch} className="mt-4" />}
        </>
      ) : usesBracketTree ? (
        <>
          <EliminationMatchesView
            matches={state.matches}
            phaseGroups={phaseGroups}
            renderMatchCard={renderMatchCard}
          />
          {onCreateMatch && <CreateCard label="Create match" onClick={onCreateMatch} className="mt-4" />}
        </>
      ) : (
        <>
          {bracketTreeUnavailable && (
            <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              These matches carry no advancement rule between them, so there is no bracket to draw yet. They are listed
              as cards until one match feeds another.
            </p>
          )}
          <RawMatchCardsView
            matches={state.matches}
            renderMatchCard={(match) => renderMatchCard(match, true)}
            onCreateMatch={onCreateMatch}
          />
        </>
      )}
    </div>
  );
}
