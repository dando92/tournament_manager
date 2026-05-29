import { useReducer } from "react";
import { initialState, matchesReducer } from "@/features/match/services/matches.reducer";
import * as MatchesApi from "@/features/match/services/matches.api";
import { CreateMatchRequest } from "@/features/match/types/match-requests";
import { MatchState } from "@/features/match/types/Match";
import { toast } from "react-toastify";

export function useMatches(divisionId: number) {
  const [state, dispatch] = useReducer(matchesReducer, initialState);

  async function list() {
    try {
      const items = await MatchesApi.listByDivision(divisionId);
      dispatch({ type: "onListMatches", payload: items });
    } catch (error) {
      console.error("Error listing matches by division:", error);
      toast.error("Error listing matches by division.");
      throw new Error("Unable to list matches by division.");
    }
  }

  async function create(request: CreateMatchRequest) {
    try {
      const item = await MatchesApi.create(request);
      dispatch({ type: "onCreateMatch", payload: item });
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
    } catch (error) {
      console.error("Error refreshing match:", error);
    }
  }

  async function updateMatchPaths(matchId: number, targetPaths: number[]) {
    try {
      await MatchesApi.updateMatchPaths(matchId, targetPaths);
      await list();
    } catch (error) {
      toast.error("Error updating match paths.");
      console.error("Error updating match paths:", error);
      throw new Error("Unable to update match paths.");
    }
  }

  async function updateMatchState(matchId: number, matchState: MatchState) {
    try {
      const item = await MatchesApi.updateMatchState(matchId, matchState);
      dispatch({ type: "onRefreshMatch", payload: item });
      const messages: Record<MatchState, string> = {
        NotActive: "Match deactivated.",
        Active: "Match activated.",
        Pending: "Match re-opened.",
        Completed: "Match completed.",
      };
      toast.success(messages[matchState]);
    } catch (error) {
      toast.error("Error updating match state.");
      console.error("Error updating match state:", error);
      throw new Error("Unable to update match state.");
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
      updateMatchPaths,
      updateMatchState,
    },
  };
}
