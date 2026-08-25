# Control Room

## Purpose

Control Room is the tournament-level operational page that defines and runs
ordered match flows. A tournament may run several flows concurrently, for
example on separate cabinets or stages. Each flow owns an ordered queue and
automatically moves its active match forward when the current match becomes
ready to commit.

Control Room does not commit results. An operator remains responsible for
reviewing and committing every result.

The lobby-control card is displayed once at tournament-page level, outside the
individual flow panels, as an independent operator tool. There is deliberately
no persisted or inferred binding between a flow, a match, and a SyncStart
lobby. The operator continues to select the lobby and an available song
explicitly.

## Scope and invariants

- Flows belong to a tournament.
- A tournament may have multiple flows in progress concurrently.
- A match may belong to at most one flow.
- Match order is authoritative and persisted in PostgreSQL.
- A flow never skips a blocked match to start a later one.
- `Unassigned` is a derived collection of tournament matches that belong to no
  flow. It is visible only while editing an inactive flow.
- The flow editor is available only while the flow is `inactive`.
- Renaming, deleting, assigning, and reordering a flow are editor operations and
  are therefore allowed only while it is `inactive`.
- A completed flow is immutable until a confirmed result reopen explicitly
  interrupts that completed run and returns it to `inactive`.
- A completed flow may be archived to hide it from the default control-room
  view. Archiving does not change its entries or match assignments.
- Manual match activation and deactivation are unavailable while any flow in
  the tournament is running or paused. This is enforced by the API as well as
  hidden or disabled in the interface.
- Before a flow activates a match, no player in that match may be present in
  another active match in the tournament.

## Lifecycle

The persisted lifecycle state is:

```text
inactive --start--------------------> running
    ^                                   |  |
    |                                   |  +-- stale: remains running
    |                                   |
    |                                   +--pause--> paused
    |                                                |
    +----------------stop-----------------------------+

running --no remaining entries--------> completed
```

The allowed states are:

- `inactive`: editable and startable; no automatic advancement is armed.
- `running`: automatic advancement is armed.
- `paused`: the current match remains active, but automatic advancement is
  suppressed.
- `completed`: the queue has been exhausted; the flow cannot be edited,
  restarted, or used as the target of `Start from here`. A confirmed result
  reopen may interrupt it and return it to `inactive` at that match.

`stale` is not a lifecycle state. It is a diagnostic condition carried by a
running flow. A stale flow remains armed and retries automatically when a
relevant persisted change triggers recalculation. Pausing is deliberate and
prevents automatic advancement even when an event resolves the condition that
would otherwise make the flow progress.

## Commands

### Start

Starting an inactive flow arms it and always recalculates from the first entry.
An earlier cursor retained by Stop or an interruption does not change ordinary
Start behavior. The runner:

1. moves past committed matches;
2. deactivates and moves past matches that are already ready to commit;
3. activates the first playable match;
4. remains running and records a stale reason when that match is not playable;
5. completes the flow when no entries remain.

Starting does not commit, reopen, or edit a match.

### Pause and resume

Pausing a running flow preserves its current active match and suppresses all
automatic advancement. Events may invalidate the UI projection, but they do
not move the cursor while the flow is paused.

Resuming changes the flow back to running and immediately recalculates it. If
the current match became ready to commit while paused, resume deactivates it and
attempts the next entry.

### Stop

Stopping a running or paused flow deactivates its current match, preserves its
cursor for diagnosis and display, clears the active stale diagnosis, and
returns it to `inactive`. The flow may then be edited, started again from the
queue head, or started explicitly from another entry.

### Start from here

`Start from here` is available from a row's context menu or actions menu only
while the flow is inactive. It moves the cursor to the selected entry and then
applies the ordinary Start algorithm. It does not change queue order and does
not reopen completed matches.

### Complete and archive

A flow becomes completed automatically when recalculation finds no remaining
entry. Completed flows cannot be edited, restarted, or used with `Start from
here` unless a confirmed result reopen interrupts the completed run.

An explicit Archive action is available only on a completed flow. Archived
flows are hidden by default and remain immutable. `Show archived` reveals them,
and Unarchive makes them visible in the ordinary completed list. A confirmed
result reopen also unarchives the flow and returns it to `inactive` at the
reopened match.

## Recalculation

Recalculation is synchronous application behavior owned by the API. Redis
Pub/Sub events are replaceable UI invalidations and must not drive the runner.

For a running flow, one recalculation:

1. locks the authoritative flow row;
2. starts at the current entry, or the first entry when the cursor is empty;
3. moves past committed matches;
4. deactivates and moves past matches that are ready to commit;
5. evaluates the first match that still needs to be played;
6. activates it and clears stale details when it is playable;
7. otherwise keeps the flow running at that entry and persists the stale code
   and structured details;
8. changes the flow to completed when no entries remain.

The runner must be idempotent. Repeated or concurrent recalculations must not
activate two successors. PostgreSQL row locking on the flow is sufficient; the
feature does not justify a distributed lock, durable queue, outbox, or generic
application event bus.

The runner may pass several settled entries in one recalculation. It never
passes an unplayable entry.

## Control-room interaction

- The tournament-level lobby control appears once above the flow panels.
- Selecting any queue row opens that match in the detail card above the queue.
- Queue rows reuse the match-list state row, including the violet current-step
  indicator, progress badge, and inline Commit action.
- Queue-row actions open from a pointer context menu or a touch long press. A
  long press is cancelled as soon as the finger moves, so scrolling the queue
  does not open it accidentally.
- Flow panels are presented one at a time in a horizontal carousel. Up to five
  flow dots appear below the card with the selected flow raised in the centre;
  the dot rail accepts clicks and mouse-wheel or trackpad scrolling. On touch
  screens a horizontal swipe advances the carousel, while an outward swipe at
  either end moves with resistance and springs back without changing the
  selected flow.
- The tournament-level lobby control follows the complete flow carousel.
- Each flow card is borderless and fills the available control-room viewport
  width.
- Flow order and assignment are changed by dragging a match within or between
  the Flow order and Unassigned columns. Arrow-based ordering is not exposed.

## Eligibility and stale reasons

Eligibility is one pure backend rule consumed by the runner. Its result is one
of:

- `eligible`: the match can be activated;
- `passed`: the match is committed or ready to commit and the cursor may move;
- `stale`: the runner must remain on the match and persist the reason.

Initial stable stale codes are:

| Code                               | Meaning                                                                                                                                               |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NO_ENTRANTS`                      | The match has no player entrant.                                                                                                                      |
| `NOT_ENOUGH_ENTRANTS`              | The match has exactly one player entrant.                                                                                                             |
| `UNRESOLVED_ENTRANTS`              | The player entrants do not fill the required slots. The requirement is at least two players, raised to the greatest incoming advancement target slot. |
| `NO_ROUNDS`                        | The match has no playable or hand-scored round.                                                                                                       |
| `MATCH_ALREADY_ACTIVE`             | The queued match is already active outside the transition the runner owns.                                                                            |
| `ENTRANTS_ALREADY_ACTIVE`          | At least one player is present in another active match.                                                                                               |
| `MATCH_REMOVED`                    | The current entry no longer resolves to a match.                                                                                                      |
| `MATCH_OUTSIDE_TOURNAMENT`         | The match no longer belongs to the flow's tournament.                                                                                                 |
| `CURRENT_MATCH_CHANGED_EXTERNALLY` | A protected current-match invariant changed outside flow commands.                                                                                    |

The database stores the stable code and structured details such as match id,
match name, entrant counts, blocking match ids, and blocking player ids. The UI
renders an operator-facing explanation from them. The diagnosis is cleared as
soon as recalculation can advance or activate the current entry.

## Recalculation triggers

The application recalculates the affected flow after a persisted change that
can alter readiness or eligibility:

- a standing is added, updated, or removed;
- a played score or hand-scored point is written;
- a round or song is added, replaced, or removed;
- match entrants are added, removed, replaced, or advanced;
- an advancement is applied or reverted;
- a result is committed or reopened;
- a match is moved or deleted;
- a match is activated or deactivated through an allowed application command;
- an advancement rule changes;
- flow entries are assigned, removed, or reordered;
- the tournament is closed or reopened.

Commit recalculation occurs after advancement has populated its targets, so the
runner evaluates the resulting match graph rather than the graph before the
commit.

The API calls a narrow synchronous recalculation collaborator from the commands
that own these writes. The runner does not call `MatchCommands`, avoiding a
dependency cycle. It owns the cross-aggregate transaction that updates the flow
and the `active` flags selected by the flow transition.

There is a small crash window between an existing match command's transaction
and its subsequent flow recalculation. Startup reconciliation of all running
flows and the next relevant command repair it. Do not add durable messaging
unless reliability requirements change.

## Manual activation

`PUT /matches/:matchId/active` refuses both activation and deactivation while
the tournament has a running or paused flow. Stale flows are running and
therefore enforce the same rule. The response is `409` with a stable code and
the flow ids responsible for the restriction.

Operators use Pause, Resume, or Stop rather than changing a flow-owned active
match behind the runner.

## Rollback confirmation

A mutation that can invalidate the current progress of a running or paused
flow requires backend-enforced confirmation. Without confirmation the API
answers `409 CONTROL_ROOM_FLOW_STOP_CONFIRMATION_REQUIRED`, naming the affected flow
and match. The client explains that continuing will stop the flow and repeats
the command only after explicit confirmation.

The confirmed operation:

1. stops the flow;
2. deactivates its current match;
3. applies the requested match mutation;
4. leaves the flow inactive at the preserved cursor;
5. reports why the flow was interrupted in the confirmation response and UI notification.

Reopening a result in a completed or archived flow uses the same confirmation
boundary. Confirmation disarchives the flow, changes it to `inactive`, places
its cursor on the reopened match, and persists `MATCH_RESULT_REOPENED` as the
interruption reason. It activates nothing. Existing standings may still make
the match ready to commit, so an operator who intends a replay must change the
standings or rounds before restarting the flow.

Before either the flow or the result changes, the API calculates the
advancement placements that reopening would remove. It refuses the reopen with
`409 ADVANCEMENT_ROLLBACK_BLOCKED_BY_TARGET_PROGRESS` when an actually affected
target match has a committed result or played score/positive hand-scored point,
or when an affected target pool contains such a match. The check includes both
rules leaving the match and rules leaving its completed pool. There is no force
override; downstream results must be reopened safely from the end of the chain
first. A rule whose affected target has not progressed remains reversible.

The frontend is not the authority for this protection: direct API callers must
receive the same requirement.

## Persistence model

`control_room_flow` stores:

- id and tournament foreign key;
- name;
- planned flow start time (`willStartAt`);
- lifecycle status;
- nullable current-entry foreign key;
- nullable stale code and structured JSON details;
- nullable interruption code, structured details, and timestamp;
- nullable archive timestamp;
- optimistic concurrency version.

`control_room_flow_entry` stores:

- id and flow foreign key;
- match foreign key;
- dense integer position.
- expected duration in minutes;
- nullable actual start and completion timestamps.

Database constraints enforce one flow per match and one entry per position in a
flow. Replacing an order is one transaction and includes the version the editor
read; a stale version answers `409` instead of silently overwriting another
operator's edit.

## API surface

The HTTP surface is:

```text
GET    /tournaments/:tournamentId/control-room/flows
GET    /tournaments/:tournamentId/control-room/creation
GET    /control-room/flows/:flowId
GET    /control-room/flows/:flowId/editor
POST   /tournaments/:tournamentId/control-room/flows
PATCH  /control-room/flows/:flowId
DELETE /control-room/flows/:flowId

PUT    /control-room/flows/:flowId/entries
POST   /control-room/flows/:flowId/start
POST   /control-room/flows/:flowId/pause
POST   /control-room/flows/:flowId/resume
POST   /control-room/flows/:flowId/stop
POST   /control-room/flows/:flowId/start-from/:entryId
POST   /control-room/flows/:flowId/archive
DELETE /control-room/flows/:flowId/archive
PATCH  /control-room/flows/:flowId/entries/:entryId/time
```

Creation accepts the flow properties, default expected duration, and initial
match order and writes the flow and entries atomically. It answers `201 { id }`;
other successful commands answer `204`. Query
DTOs include lifecycle state, current entry, queue, archive state, stale code,
stale details, and the projected match data required by the control room. The
editor query additionally includes unassigned matches.

Writes publish `ui.control-room-flow-changed` addressed by tournament and flow. Any
automatic active-state change also publishes the existing match invalidation.
The focused expected-duration edit is the exception: it updates the initiating
client locally and deliberately publishes no realtime invalidation.

## Frontend behavior

Control Room is a tournament-level tree destination. It shows one operational
panel per non-archived flow. A panel contains:

- flow name and lifecycle status;
- a separate `Waiting` diagnosis when a running flow is stale;
- the current active match card, or the pending match card while stale;
- the independent lobby-control card;
- the next queued matches;
- Start, Pause, Resume, Stop, Edit, Archive, and context actions allowed by the
  current state.

The word `Waiting` is used for the operator-facing stale condition. `Paused`
remains visibly distinct because it was chosen by an operator and cannot
advance from an event.

The editor is reachable only for an inactive flow. It displays flow entries and
an Unassigned collection, supports drag-and-drop within the flow and between
the flow and Unassigned, and also supplies keyboard-accessible move actions.
Moving a match directly between two flows requires both flows to be inactive.

Completed flows expose Archive. The page hides archived flows by default and
provides `Show archived`; unarchiving changes visibility only.

## Code organization

The API capability belongs under:

```text
apps/api/src/tournament/competition/control-room/
    control-room.aggregate.ts
    control-room.commands.ts
    control-room.controller.ts
    control-room.requests.ts
    control-room.store.ts
    control-room.queries.ts
    control-room.runner.ts
    control-room.eligibility.ts
    control-room.bootstrap.ts
```

Shared DTOs belong in `packages/contracts/src/control-room.ts`; TypeORM metadata
belongs in `packages/persistence/src/entities/`; executable schema changes
belong in `apps/migrations`.

The frontend capability belongs under `apps/frontend/src/features/control-room/`
with `api`, `model`, and `ui` roles. The route page is
`apps/frontend/src/pages/tournament/ControlRoomPage.tsx`.

## Implementation plan

Status: delivered on 2026-08-24. The phases below are retained as the
implementation and verification record.

Each phase is a coherent checkpoint. Relevant unit and end-to-end tests pass
before proceeding, and the migration status records the completed checkpoint
when implementation begins.

### Phase 1: schema and contracts

- Add `control_room_flow` and `control_room_flow_entry` entities and the clean-baseline
  migration.
- Add lifecycle, stale-code, stale-detail, control-room, editor, and command
  contracts.
- Register persistence metadata and enforce unique match assignment, entry
  position, archive, and optimistic-version constraints.
- Add migration coverage.

### Phase 2: aggregate, eligibility, store, and queries

- Implement and unit-test lifecycle transitions, editability, terminal
  completion, archive rules, cursor behavior, and stale diagnosis ownership.
- Implement the pure eligibility result without persistence or transport.
- Implement the aggregate store and transaction-safe order replacement.
- Implement control-room and editor projections, including derived Unassigned
  matches.
- Resolve the expected-entrant rule before closing this phase.

### Phase 3: transactional runner

- Implement row-locked, idempotent recalculation.
- Apply active-state transitions and cursor/stale changes in one transaction.
- Detect player overlap with other active matches.
- Add concurrent recalculation and multi-entry progression tests.
- Add startup reconciliation for running flows; paused flows remain paused.

### Phase 4: commands, API, and manual-activation guard

- Add CRUD, ordering, Start, Pause, Resume, Stop, Start from here, Archive, and
  Unarchive commands and routes.
- Restrict editing to inactive flows and make completed flows terminal.
- Reject manual activation and deactivation while any flow is running or
  paused.
- Publish flow and affected-match invalidations.
- Add authorization, open-tournament, lifecycle, conflict, and archive API
  tests.

### Phase 5: match and advancement triggers

- Invoke the narrow recalculator after every readiness and eligibility change.
- Ensure commit recalculates after advancement and reopen recalculates after
  revert.
- Handle match deletion by locating the affected flow before cascade removal.
- Implement and test backend-enforced rollback confirmation.
- Resolve and implement the completed-flow rollback policy before closing this
  phase.

### Phase 6: control-room frontend

- Add the tournament tree destination and route.
- Build flow panels, lifecycle actions, current/pending match presentation,
  queue preview, and stale explanations.
- Reuse the lobby-control card without adding any flow or match binding.
- Disable manual activation consistently with the API guard.
- Add Archive, Show archived, and Unarchive behavior.

### Phase 7: flow editor

- Build create, rename, delete, assignment, and persisted ordering workflows.
- Show Unassigned only inside the inactive-flow editor.
- Add drag-and-drop and equivalent keyboard move controls.
- Handle optimistic conflicts with an explicit reload path.
- Keep completed and paused flows outside the editor.

### Phase 8: integration and operational verification

- Cover parallel running flows, stale recovery, pause/resume, stop/restart,
  commit-driven entrant resolution, player conflicts, archive visibility, and
  API restart reconciliation in end-to-end tests.
- Verify completed-song ingestion advances exactly one eligible flow transition
  and never commits a result.
- Verify duplicate recalculation is harmless under multiple API replicas.
- Update local fixtures and operational documentation with a representative
  multi-flow tournament.

## Resolved decisions

- A match requires at least two player entrants. Incoming advancement rules
  raise that requirement to their greatest target slot.
- Reopening a result in a completed or archived flow requires confirmation. It
  disarchives the flow, returns it to `inactive`, positions the cursor at that
  match, and records the interruption. The reopen is refused when an affected
  advancement target already has scores or a committed result.
- Closing a tournament stops its running and paused flows and deactivates their
  current matches. Reopening the tournament does not restart them.

These decisions resolve FQ-027 in [FunctionalQuestions.md](FunctionalQuestions.md).
