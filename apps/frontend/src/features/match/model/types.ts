import type { AdvancementRuleDto } from "@tournament-manager/contracts";

/**
 * What the match views read, under the names they read it by.
 *
 * The responses come from the contracts package, which both workspaces speak.
 * What is declared here is the rest: the requests the views send, and the view
 * types that describe the interface's own state rather than the server's.
 */
export type {
  AdvancementCompetitionKind,
  AdvancementRuleDto as AdvancementRule,
  MatchDto as Match,
  MatchRoundDto as Round,
  ScoreDto as Score,
  CommitMatchResultResponseDto as CommitMatchResultResponse,
} from "@tournament-manager/contracts";

export type MatchCommitState = "Disabled" | "Tiebreak" | "Pending" | "Completed";

/**
 * A rule as the editor holds it before it is saved. The identifier is the
 * server's to assign, so a draft carries the four fields that describe the
 * destination and nothing else.
 */
export type AdvancementRuleInput = Pick<
  AdvancementRuleDto,
  "sourcePlacement" | "targetKind" | "targetId" | "targetSlot"
>;
export type MatchAdvancementRuleInput = AdvancementRuleInput;

/** Which match the interface is pointing at. A view concern, never a response. */
export type MatchHighlight = {
  matchId: number | null;
  phaseGroupId: number | null;
};

export interface CreateMatchRequest {
  phaseGroupId: number;
  name: string;
  subtitle: string;
  scoringSystem: string;
  notes: string;
  group: string;
  levels: string;
  songIds: number[];
  entrantIds: number[];
}

/**
 * Where a round's song comes from. Empty means no song at all, which is the
 * hand-scored round.
 *
 * A roll says which group and level it wants; the division whose pool it draws
 * from is the match's own, which the server reads rather than being told.
 */
export interface RoundSourceRequest {
  songId?: number;
  group?: string;
  level?: string;
}
