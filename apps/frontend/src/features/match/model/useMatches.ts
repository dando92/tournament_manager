import { useEffect, useMemo, useReducer } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { initialState, matchesReducer } from "@/features/match/model/matchesReducer";
import * as MatchesApi from "@/features/match/api/match.api";
import { CreateMatchRequest, RoundSourceRequest, Match, MatchAdvancementRuleInput } from "@/features/match/model/types";
import { matchKeys } from "@/features/match/api/match.keys";
import { updateAdvancementRulesForSource } from "@/features/advancement/services/advancement-rules.api";
import { toast } from "react-toastify";

export function useMatches(divisionId: number, phaseGroupId?: number) {
  const [state, dispatch] = useReducer(matchesReducer, initialState);
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => (phaseGroupId !== undefined ? matchKeys.byPhaseGroup(phaseGroupId) : matchKeys.byDivision(divisionId)),
    [divisionId, phaseGroupId],
  );
  const query = useQuery({
    queryKey,
    queryFn: () => phaseGroupId !== undefined
      ? MatchesApi.listByPhaseGroup(phaseGroupId)
      : MatchesApi.listByDivision(divisionId),
  });

  useEffect(() => {
    if (query.data) {
      dispatch({ type: "onListMatches", payload: query.data });
    }
  }, [query.data]);

  function setCachedMatches(updater: (matches: Match[]) => Match[]) {
    queryClient.setQueryData<Match[]>(queryKey, (current) => updater(current ?? state.matches));
  }

  function setCachedMatch(match: Match) {
    setCachedMatches((matches) => matches.map((candidate) => candidate.id === match.id ? { ...candidate, ...match } : candidate));
  }

  async function list() {
    try {
      const result = await query.refetch();
      const items = result.data ?? [];
      dispatch({ type: "onListMatches", payload: items });
    } catch (error) {
      console.error("Error listing matches:", error);
      toast.error("Error listing matches.");
      throw new Error("Unable to list matches.");
    }
  }

  async function create(request: CreateMatchRequest) {
    try {
      const item = await MatchesApi.create(request);
      dispatch({ type: "onCreateMatch", payload: item });
      setCachedMatches((matches) => [...matches, item]);
      toast.success("Match created successfully.");
    } catch (error) {
      toast.error("Error creating match.");
      console.error("Error creating match:", error);
      throw new Error("Unable to create match.");
    }
  }

  async function editMatchNotes(matchId: number, notes: string) {
    try {
      await MatchesApi.editMatchNotes(matchId, notes);
      dispatch({ type: "onEditMatchNotes", payload: [matchId, notes] });
      setCachedMatches((matches) => matches.map((match) => match.id === matchId ? { ...match, notes } : match));
    } catch (error) {
      toast.error("Error editing match notes.");
      console.error("Error editing match notes:", error);
      throw new Error("Unable to edit match notes.");
    }
  }

  async function renameMatch(matchId: number, name: string) {
    try {
      await MatchesApi.renameMatch(matchId, name);
      dispatch({ type: "onRenameMatch", payload: [matchId, name] });
      setCachedMatches((matches) => matches.map((match) => match.id === matchId ? { ...match, name } : match));
    } catch (error) {
      toast.error("Error renaming match.");
      console.error("Error renaming match:", error);
      throw new Error("Unable to rename match.");
    }
  }

  async function deleteMatch(matchId: number) {
    try {
      await MatchesApi.deleteMatch(matchId);
      dispatch({
        type: "onDeleteMatch",
        payload: state.matches.find((m) => m.id === matchId)!,
      });
      setCachedMatches((matches) => matches.filter((match) => match.id !== matchId));
    } catch (error) {
      toast.error("Error deleting match.");
      console.error("Error deleting match:", error);
      throw new Error("Unable to delete match.");
    }
  }

  async function updateMatchEntrants(matchId: number, entrantIds: number[]) {
    try {
      const item = await MatchesApi.updateMatchEntrants(matchId, entrantIds);
      dispatch({ type: "onRefreshMatch", payload: item });
      setCachedMatch(item);
    } catch (error) {
      toast.error("Error updating match players.");
      console.error("Error updating match players:", error);
      throw new Error("Unable to update match players.");
    }
  }

  async function addRound(matchId: number, source: RoundSourceRequest = {}) {
    try {
      const item = await MatchesApi.addRound(matchId, source);
      dispatch({ type: "onRefreshMatch", payload: item });
      setCachedMatch(item);
    } catch (error) {
      toast.error("Error adding a round to the match.");
      console.error("Error adding a round to the match:", error);
      throw new Error("Unable to add a round to the match.");
    }
  }

  async function deleteRound(roundId: number) {
    try {
      const item = await MatchesApi.deleteRound(roundId);
      dispatch({ type: "onRefreshMatch", payload: item });
      setCachedMatch(item);
    } catch (error) {
      toast.error("Error deleting the round.");
      console.error("Error deleting the round:", error);
      throw new Error("Unable to delete the round.");
    }
  }

  async function replaceRoundSong(roundId: number, source: RoundSourceRequest) {
    try {
      const item = await MatchesApi.replaceRoundSong(roundId, source);
      dispatch({ type: "onRefreshMatch", payload: item });
      setCachedMatch(item);
    } catch (error) {
      toast.error("Error replacing the song of the round.");
      console.error("Error replacing the song of the round:", error);
      throw new Error("Unable to replace the song of the round.");
    }
  }

  /*
   * A cell in the table is a player and a round, and every callback in the
   * interface names them in that order. The routes name the round first,
   * because the round is what they address. Both are numbers, so nothing would
   * complain if the two conventions met by accident: they meet here, once, next
   * to the call that builds the URL.
   */
  async function saveScore(
    playerId: number,
    roundId: number,
    score: { percentage: number; isFailed: boolean; scoreId?: number },
  ) {
    try {
      const item = await MatchesApi.upsertScore(roundId, playerId, score);
      dispatch({ type: "onRefreshMatch", payload: item });
      setCachedMatch(item);
    } catch (error) {
      toast.error("Error saving the score.");
      console.error("Error saving the score:", error);
      throw new Error("Unable to save the score.");
    }
  }

  /** Hand-scored points. They reach the server as they are typed, like any score. */
  async function savePoints(playerId: number, roundId: number, points: number) {
    try {
      const item = await MatchesApi.upsertPoints(roundId, playerId, points);
      dispatch({ type: "onRefreshMatch", payload: item });
      setCachedMatch(item);
    } catch (error) {
      toast.error("Error saving the points.");
      console.error("Error saving the points:", error);
      throw new Error("Unable to save the points.");
    }
  }

  async function deleteStanding(playerId: number, roundId: number) {
    try {
      const item = await MatchesApi.deleteStanding(roundId, playerId);
      dispatch({ type: "onRefreshMatch", payload: item });
      setCachedMatch(item);
    } catch (error) {
      toast.error("Error deleting the standing.");
      console.error("Error deleting the standing:", error);
      throw new Error("Unable to delete the standing.");
    }
  }

  async function refreshMatch(matchId: number) {
    try {
      const item = await MatchesApi.getMatch(matchId);
      dispatch({ type: "onRefreshMatch", payload: item });
      setCachedMatch(item);
    } catch (error) {
      console.error("Error refreshing match:", error);
    }
  }

  async function updateMatchAdvancementRules(matchId: number, rules: MatchAdvancementRuleInput[]) {
    try {
      await updateAdvancementRulesForSource("match", matchId, rules);
      await list();
    } catch (error) {
      toast.error("Error updating match advancement rules.");
      console.error("Error updating match advancement rules:", error);
      throw new Error("Unable to update match advancement rules.");
    }
  }

  async function updateMatchActive(matchId: number, active: boolean) {
    try {
      const item = await MatchesApi.updateMatchActive(matchId, active);
      dispatch({ type: "onRefreshMatch", payload: item });
      setCachedMatch(item);
      toast.success(active ? "Match activated." : "Match deactivated.");
    } catch (error) {
      toast.error("Error updating match active state.");
      console.error("Error updating match active state:", error);
      throw new Error("Unable to update match active state.");
    }
  }

  async function commitMatchResult(matchId: number) {
    try {
      const { match, startggReport } = await MatchesApi.commitMatchResult(matchId);
      dispatch({ type: "onRefreshMatch", payload: match });
      setCachedMatch(match);
      if (startggReport === "failed") {
        toast.warn("Match completed, but reporting the result to start.gg failed.");
      } else if (startggReport === "reported") {
        toast.success("Match completed and reported to start.gg.");
      } else {
        toast.success("Match completed.");
      }
    } catch (error) {
      toast.error("Error committing match result.");
      console.error("Error committing match result:", error);
      throw new Error("Unable to commit match result.");
    }
  }

  async function reopenMatchResult(matchId: number) {
    try {
      const item = await MatchesApi.reopenMatchResult(matchId);
      dispatch({ type: "onRefreshMatch", payload: item });
      setCachedMatch(item);
      toast.success("Match re-opened.");
    } catch (error) {
      toast.error("Error re-opening match.");
      console.error("Error re-opening match:", error);
      throw new Error("Unable to re-open match.");
    }
  }

  return {
    state,
    actions: {
      list,
      create,
      refreshMatch,
      editMatchNotes,
      renameMatch,
      deleteMatch,
      updateMatchEntrants,
      addRound,
      deleteRound,
      replaceRoundSong,
      saveScore,
      savePoints,
      deleteStanding,
      updateMatchAdvancementRules,
      updateMatchActive,
      commitMatchResult,
      reopenMatchResult,
    },
  };
}
