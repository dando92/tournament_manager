import { useEffect, useMemo, useReducer } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { initialState, matchesReducer } from "@/features/match/services/matches.reducer";
import * as MatchesApi from "@/features/match/services/matches.api";
import { CommitMatchResultRequest, CreateMatchRequest } from "@/features/match/types/match-requests";
import { Match, MatchAdvancementRuleInput } from "@/features/match/types/Match";
import { updateAdvancementRulesForSource } from "@/features/advancement/services/advancement-rules.api";
import { toast } from "react-toastify";

export function useMatches(divisionId: number, phaseGroupId?: number) {
  const [state, dispatch] = useReducer(matchesReducer, initialState);
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => phaseGroupId !== undefined
      ? ["matches", "phase-group", phaseGroupId] as const
      : ["matches", "division", divisionId] as const,
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

  async function deleteSongFromMatch(matchId: number, songId: number) {
    try {
      const item = await MatchesApi.deleteSongFromMatch(matchId, songId);
      dispatch({ type: "onDeleteSongFromMatch", payload: item });
      setCachedMatch(item);
    } catch (error) {
      toast.error("Error deleting song from match.");
      console.error("Error deleting song from match:", error);
      throw new Error("Unable to delete song from match.");
    }
  }

  async function addSongToMatchByRoll(
    matchId: number,
    divisionId: number,
    group: string,
    level: string,
  ) {
    try {
      const item = await MatchesApi.addSongToMatch(matchId, undefined, divisionId, group, level);
      dispatch({ type: "onAddSongToMatch", payload: item });
      setCachedMatch(item);
    } catch (error) {
      toast.error("Error adding song to match.");
      console.error("Error adding song to match:", error);
      throw new Error("Unable to add song to match.");
    }
  }

  async function editSongToMatchByRoll(
    matchId: number,
    editSongId: number,
    divisionId: number,
    group: string,
    level: string,
  ) {
    try {
      const item = await MatchesApi.editSongInMatch(matchId, editSongId, undefined, divisionId, group, level);
      dispatch({ type: "onAddSongToMatch", payload: item });
      setCachedMatch(item);
    } catch (error) {
      toast.error("Error editing song in match.");
      console.error("Error editing song in match:", error);
      throw new Error("Unable to edit song in match.");
    }
  }

  async function addSongToMatchBySongId(
    matchId: number,
    songId: number,
  ) {
    try {
      const item = await MatchesApi.addSongToMatch(matchId, songId);
      dispatch({ type: "onAddSongToMatch", payload: item });
      setCachedMatch(item);
    } catch (error) {
      toast.error("Error adding song to match.");
      console.error("Error adding song to match:", error);
      throw new Error("Unable to add song to match.");
    }
  }

  async function editSongToMatchBySongId(
    matchId: number,
    editSongId: number,
    songId: number,
  ) {
    try {
      const item = await MatchesApi.editSongInMatch(matchId, editSongId, songId);
      dispatch({ type: "onAddSongToMatch", payload: item });
      setCachedMatch(item);
    } catch (error) {
      toast.error("Error editing song in match.");
      console.error("Error editing song in match:", error);
      throw new Error("Unable to edit song in match.");
    }
  }

  async function addStandingToMatch(
    matchId: number,
    playerId: number,
    songId: number,
    percentage: number,
    score: number,
    isFailed: boolean,
    scoreId?: number,
  ) {
    try {
      const item = await MatchesApi.addStandingToMatch(matchId, {
        playerId,
        songId,
        percentage,
        score,
        isFailed,
        scoreId,
      });
      dispatch({ type: "onAddStandingToMatch", payload: item });
      setCachedMatch(item);
    } catch (error) {
      toast.error("Error adding standing to match.");
      console.error("Error adding standing to match:", error);
      throw new Error("Unable to add standing to match.");
    }
  }

  async function deleteStandingsForPlayerFromMatch(
    matchId: number,
    playerId: number,
    songId: number,
  ) {
    try {
      const item = await MatchesApi.deleteStandingFromMatch(matchId, playerId, songId);
      dispatch({ type: "onDeleteStandingFromMatch", payload: item });
      setCachedMatch(item);
    } catch (error) {
      toast.error("Error deleting standings for player from match.");
      console.error("Error deleting standings for player from match:", error);
      throw new Error("Unable to delete standings for player from match.");
    }
  }

  async function editStandingFromMatch(
    matchId: number,
    songId: number,
    playerId: number,
    percentage: number,
    score: number,
    isFailed: boolean,
    scoreId?: number,
  ) {
    try {
      const item = await MatchesApi.editStandingInMatch(
        matchId,
        songId,
        playerId,
        percentage,
        score,
        isFailed,
        scoreId,
      );
      dispatch({ type: "onEditStandingFromMatch", payload: item });
      setCachedMatch(item);
    } catch (error) {
      toast.error("Error editing standings for player from match.");
      console.error("Error editing standings for player from match:", error);
      throw new Error("Unable to edit standings for player from match.");
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

  async function commitMatchResult(matchId: number, request?: CommitMatchResultRequest) {
    try {
      const { match, startggReport } = await MatchesApi.commitMatchResult(matchId, request);
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
      deleteSongFromMatch,
      addSongToMatchByRoll,
      addSongToMatchBySongId,
      editSongToMatchByRoll,
      editSongToMatchBySongId,
      addStandingToMatch,
      editStandingFromMatch,
      deleteStandingsForPlayerFromMatch,
      updateMatchAdvancementRules,
      updateMatchActive,
      commitMatchResult,
      reopenMatchResult,
    },
  };
}
