/**
 * The words the HTTP responses are written in.
 *
 * Every one of these is a closed set the interface branches on, so it is a
 * union rather than `string`. They are declared here rather than taken from
 * `@tournament-manager/persistence`, which the browser must not depend on: the
 * entity columns hold the same values and are checked against these types
 * wherever the API projects a row.
 */

export type TournamentStatus = 'open' | 'closed';

export type ParticipantRole = 'competitor' | 'spectator' | 'owner' | 'staff' | 'unknown';
export type ParticipantStatus = 'registered' | 'checked_in' | 'withdrawn' | 'unknown';

export type EntrantType = 'player' | 'team';
export type EntrantStatus = 'active' | 'dropped' | 'withdrawn' | 'dq' | 'unknown';

/**
 * Where a match stands in its result lifecycle.
 *
 * `open` holds nothing anybody played, `partial` holds evidence that does not
 * settle it yet, `ready` can be committed as it is, `tiebreak_required` is
 * settled on points but tied where the tie decides where somebody goes, and
 * `completed` has its result written. The order is total: everything above
 * `open` carries evidence.
 *
 * `active` says something else entirely — that a match is on a cabinet now.
 */
export type MatchState = 'open' | 'partial' | 'ready' | 'tiebreak_required' | 'completed';

export type PhaseGroupState = 'pending' | 'active' | 'completed';
export type PhaseGroupEntrantStatus = 'pending' | 'active' | 'advanced' | 'eliminated' | 'withdrawn' | 'dq';

export type AdvancementCompetitionKind = 'match' | 'phase_group';

/**
 * The difficulty slot a chart occupies, as StepMania names it.
 *
 * It is not the meter. A chart carries both: `Expert` is which of the six
 * slots the pack author put the chart in, and `13` is how hard it is. The two
 * simfile names that differ from what a player reads on the cabinet are
 * translated on the way in — `Beginner` is `Novice` and `Challenge` is
 * `Expert` — so the interface never has to know both vocabularies.
 */
export type ChartDifficulty = 'Novice' | 'Easy' | 'Medium' | 'Hard' | 'Expert' | 'Edit';
