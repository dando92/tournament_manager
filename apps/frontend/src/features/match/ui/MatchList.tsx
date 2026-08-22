import { useMemo, type ReactNode } from "react";
import { Division } from "@/features/division/types/Division";
import { PoolViewMode } from "@/features/division/services/poolViewMode";
import { PhaseGroup } from "@/features/division/types/Phase";
import EliminationMatchesView from "@/features/match/ui/bracket/EliminationMatchesView";
import MatchCard from "@/features/match/ui/MatchCard";
import RawMatchCardsView from "@/features/match/ui/RawMatchCardsView";
import RoundRobinMatchesView from "@/features/match/ui/round-robin/RoundRobinMatchesView";
import { useAdvancementTargets } from "@/features/match/model/useAdvancementTargets";
import { useMatches } from "@/features/match/model/useMatches";
import { Match, MatchHighlight } from "@/features/match/model/types";
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
  const loadAdvancementTargets = useAdvancementTargets(division.id);
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
      loadAdvancementTargets={phaseGroupId !== undefined ? loadAdvancementTargets : undefined}
      tournamentId={tournamentId}
      highlight={highlight}
      onHighlight={onHighlight}
      enablePathRowHighlight={enablePathRowHighlight}
      onDeleteStanding={actions.deleteStanding}
      onMatchUpdated={refreshMatches}
      onEditMatchNotes={actions.editMatchNotes}
      onRenameMatch={actions.renameMatch}
      onDeleteMatch={actions.deleteMatch}
      onAddPlayersToMatch={(entrantIds) =>
        actions.updateMatchEntrants(match.id, entrantIds)
      }
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
      onUpdateMatchAdvancementRules={actions.updateMatchAdvancementRules}
      onUpdateMatchActive={actions.updateMatchActive}
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
          <p className="text-center text-ui-text-mute text-sm py-8">No matches yet.</p>
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
            <p className="mb-3 rounded border border-state-pending/30 bg-state-pending/10 px-3 py-2 text-xs text-ui-text-soft">
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
