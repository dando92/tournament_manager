import { Match } from "@/features/match/types/Match";
import { MatchesActions } from "@/features/match/services/matches.actions";

export type MatchesState = {
  matches: Match[];
};

export const initialState: MatchesState = {
  matches: [],
};

function mergeUpdatedMatch(matches: Match[], payload: Match) {
  return matches.map((match) =>
    match.id === payload.id ? { ...match, ...payload } : match,
  );
}

export function matchesReducer(state: MatchesState, action: MatchesActions) {
  const { type, payload } = action;

  switch (type) {
    case "onListMatches":
      return {
        ...state,
        matches: payload,
      };
    case "onCreateMatch":
      return {
        ...state,
        matches: [...state.matches, payload],
      };
    case "onEditMatchNotes":
      return {
        ...state,
        matches: state.matches.map((match) =>
          match.id === payload[0] ? { ...match, notes: payload[1] } : match,
        ),
      };
    case "onRenameMatch":
      return {
        ...state,
        matches: state.matches.map((match) =>
          match.id === payload[0] ? { ...match, name: payload[1] } : match,
        ),
      };
    case "onDeleteMatch":
      return {
        ...state,
        matches: state.matches.filter((match) => match.id !== payload.id),
      };
    case "onAddSongToMatch":
      return {
        ...state,
        matches: mergeUpdatedMatch(state.matches, payload),
      };
    case "onDeleteSongFromMatch":
      return {
        ...state,
        matches: mergeUpdatedMatch(state.matches, payload),
      };
    case "onAddStandingToMatch":
      return {
        ...state,
        matches: mergeUpdatedMatch(state.matches, payload),
      };
    case "onDeleteStandingFromMatch":
      return {
        ...state,
        matches: mergeUpdatedMatch(state.matches, payload),
      };
    case "onEditStandingFromMatch":
      return {
        ...state,
        matches: mergeUpdatedMatch(state.matches, payload),
      };
    case "onRefreshMatch":
      return {
        ...state,
        matches: mergeUpdatedMatch(state.matches, payload),
      };
    default:
      return state;
  }
}
