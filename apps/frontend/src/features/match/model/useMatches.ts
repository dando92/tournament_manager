import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as MatchesApi from "@/features/match/api/match.api";
import { matchKeys } from "@/features/match/api/match.keys";
import { updateAdvancementRulesForSource } from "@/features/match/api/advancement-rule.api";
import { CreateMatchRequest, MatchAdvancementRuleInput, RoundSourceRequest } from "@/features/match/model/types";
import { usePageNotices } from "@/shared/context/PageNoticeContext";

/**
 * The matches of a division, or of one pool inside it, and every change they
 * undergo.
 *
 * The list is the query cache and nothing else. A write answers `204`, the
 * server announces what it changed, and the invalidation that follows is what
 * puts the new state on screen — the same path a second person watching the
 * same pool travels, rather than a private one for whoever pressed the button.
 *
 * The reducer this hook used to keep is gone with that second path. It held a
 * copy of the list that every action had to patch by hand, and the patch was
 * only ever right for the match the action addressed: committing a result moves
 * entrants into a match further along, and nothing here could know that.
 */
export function useMatches(divisionId: number, phaseGroupId?: number) {
  const queryClient = useQueryClient();
  const { report, dismiss } = usePageNotices();
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

  /**
   * One write taken straight from the page, and what to say if it fails.
   *
   * Nothing is applied here on success: the realtime invalidation refetches the
   * list. These are the writes with no dialog to hold the answer — a score
   * typed into a cell, a round deleted from the table — so the failure goes to
   * the page notice slot and the original error is re-thrown, which keeps the
   * server's own sentence available to anyone above who can show it. Succeeding
   * takes the sentence back: a write that worked has nothing left to report.
   *
   * The writes a dialog drives do not come through here. They report nothing,
   * let the failure out, and the dialog that asked stays open and states it.
   */
  async function run(work: () => Promise<void>, failure: string): Promise<void> {
    try {
      await work();
      dismiss(failure);
    } catch (error) {
      console.error(failure, error);
      report(failure);
      throw error;
    }
  }

  /** Re-reads the list now, for the few callers that cannot wait for the event. */
  async function list() {
    await queryClient.invalidateQueries({ queryKey, exact: true });
  }

  return {
    matches: query.data ?? [],
    loading: query.isLoading,
    actions: {
      list,

      /* ---- asked for in a dialog: it reports, this does not ---- */

      create: (request: CreateMatchRequest) => MatchesApi.create(request),

      editMatchNotes: (matchId: number, notes: string) => MatchesApi.editMatchNotes(matchId, notes),

      updateMatchScoringSystem: (matchId: number, scoringSystem: string) =>
        MatchesApi.updateMatchScoringSystem(matchId, scoringSystem),

      updateMatchEntrants: (matchId: number, entrantIds: number[]) => MatchesApi.updateMatchEntrants(matchId, entrantIds),

      replaceRoundSong: (roundId: number, source: RoundSourceRequest) => MatchesApi.replaceRoundSong(roundId, source),

      /* ---- taken from the page ---- */

      renameMatch: (matchId: number, name: string) =>
        run(() => MatchesApi.renameMatch(matchId, name), "Error renaming match."),

      deleteMatch: (matchId: number) =>
        run(() => MatchesApi.deleteMatch(matchId), "Error deleting match."),

      /* Both of these are also reachable from a dialog, so until the page has
         a banner of its own they report twice there rather than not at all. */
      addRound: (matchId: number, source: RoundSourceRequest = {}) =>
        run(() => MatchesApi.addRound(matchId, source), "Error adding a round to the match."),

      deleteRound: (roundId: number) =>
        run(() => MatchesApi.deleteRound(roundId), "Error deleting the round."),

      /*
       * A cell in the table is a player and a round, and every callback in the
       * interface names them in that order. The routes name the round first,
       * because the round is what they address. Both are numbers, so nothing
       * would complain if the two conventions met by accident: they meet here,
       * once, next to the call that builds the URL.
       */
      saveScore: (
        playerId: number,
        roundId: number,
        score: { percentage: number; isFailed: boolean; scoreId?: number },
      ) => run(() => MatchesApi.upsertScore(roundId, playerId, score), "Error saving the score."),

      /** Hand-scored points. They reach the server as they are typed, like any score. */
      savePoints: (playerId: number, roundId: number, points: number) =>
        run(() => MatchesApi.upsertPoints(roundId, playerId, points), "Error saving the points."),

      deleteStanding: (playerId: number, roundId: number) =>
        run(() => MatchesApi.deleteStanding(roundId, playerId), "Error deleting the standing."),

      createTiebreak: (matchId: number, playerIds: number[], songId?: number) =>
        run(() => MatchesApi.createTiebreak(matchId, playerIds, songId).then(() => undefined), "Error creating the tiebreak."),

      deleteTiebreak: (matchId: number, tiebreakId: number) =>
        run(() => MatchesApi.deleteTiebreak(matchId, tiebreakId), "Error deleting the tiebreak."),

      saveTiebreakScore: (
        matchId: number,
        tiebreakId: number,
        playerId: number,
        score: { percentage: number; isFailed: boolean; scoreId?: number },
      ) => run(() => MatchesApi.upsertTiebreakScore(matchId, tiebreakId, playerId, score), "Error saving the tiebreak score."),

      saveTiebreakPoints: (matchId: number, tiebreakId: number, playerId: number, points: number) =>
        run(() => MatchesApi.upsertTiebreakPoints(matchId, tiebreakId, playerId, points), "Error saving the tiebreak points."),

      clearTiebreakStanding: (matchId: number, tiebreakId: number, playerId: number) =>
        run(() => MatchesApi.clearTiebreakStanding(matchId, tiebreakId, playerId), "Error clearing the tiebreak standing."),

      /* An advancement rule is not part of the match aggregate, but writing one
         now announces the pool its source sits in, so it moves like every other
         write and nothing here re-reads. */
      updateMatchAdvancementRules: (matchId: number, rules: MatchAdvancementRuleInput[]) =>
        run(
          () => updateAdvancementRulesForSource("match", matchId, rules),
          "Error updating match advancement rules.",
        ),

      updateMatchActive: (matchId: number, active: boolean) =>
        run(() => MatchesApi.updateMatchActive(matchId, active), "Error updating match active state."),

      /* The violet dot, the committed card and the re-opened table are the
         report. Only the part that happened somewhere else — the result start.gg
         did not take — is still worth a sentence. */
      commitMatchResult: (matchId: number) =>
        run(async () => {
          const { startggReport } = await MatchesApi.commitMatchResult(matchId);
          if (startggReport === "failed") {
            report("Match completed, but reporting the result to start.gg failed.", {
              tone: "warning",
              detail: "The bracket here is correct. The one on start.gg is not.",
            });
          }
        }, "Error committing match result."),

      reopenMatchResult: (matchId: number) =>
        run(async () => {
          try {
            await MatchesApi.reopenMatchResult(matchId);
          } catch (error) {
            if (error instanceof MatchesApi.AdvancementRollbackBlockedError) {
              report(error.message);
              return;
            }
            throw error;
          }
        }, "Error re-opening match."),
    },
  };
}
