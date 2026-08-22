import { entrantPlayers } from "@/features/entrant/types/Entrant";
import { Match } from "@/features/match/types/Match";

/**
 * What a match can be found by.
 *
 * Everything here is already in the list payload — players come with the
 * entrants, titles with the rounds — so the search is a filter over loaded
 * data rather than a request. That is also why it widens to the whole
 * division rather than the open pool: mid-tournament the question is "where
 * did that player end up", and the answer is useless if it stops at the branch
 * you happen to be looking at.
 */
export function matchMatchesQuery(match: Match, query: string, poolName: string, phaseName: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  const haystack = [
    match.name,
    match.subtitle,
    poolName,
    phaseName,
    ...match.rounds.flatMap((round) => (round.song ? [round.song.title] : [])),
    ...entrantPlayers(match.entrants).map((player) => player.playerName),
    ...match.entrants.map((entrant) => entrant.name),
  ];

  return haystack.some((value) => value?.toLowerCase().includes(needle));
}
