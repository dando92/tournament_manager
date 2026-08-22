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

export type PhaseGroupState = 'pending' | 'active' | 'completed';
export type PhaseGroupEntrantStatus = 'pending' | 'active' | 'advanced' | 'eliminated' | 'withdrawn' | 'dq';

export type AdvancementCompetitionKind = 'match' | 'phase_group';
