# Tournament Timeline

## Purpose

The tournament overview presents each non-archived Control Room flow as a
read-only chronological timeline. It lets an operator or spectator understand
the current match, inspect neighboring matches, and compare the live run with
the planned schedule without exposing Control Room operations.

## Timing model

- `control_room_flow.willStartAt` is the only persisted planned absolute time.
- Every `control_room_flow_entry` owns `expectedDurationMinutes`.
- Planned entry start times are derived by adding all preceding expected
  durations to `willStartAt`; they are never persisted.
- `startedAt` is recorded when the runner activates an entry.
- `completedAt` is recorded in the same runner transaction that advances past
  an entry considered settled by the existing Control Room lifecycle.
- Reordering preserves existing entry ids, durations, and actual timestamps.
- Activating an entry again records the start of the new run and clears its
  prior completion timestamp.

The global live offset is derived without changing planned data. The current
entry's actual start is preferred. Otherwise the latest actual completion is
compared with its planned completion. A running entry that has not started can
accumulate delay against the current clock. The precise offset remains in
milliseconds; only its label is rounded to ten-minute increments. Differences
below five minutes display as `ON TIME`.

## Flow creation and editing

Flow creation is one modal and one atomic API operation. It requires a name,
`Will start at`, a default expected match duration, and at least one match in
the interface. Matches are dragged into their initial order. The default is a
creation input, not persisted on the flow: it is copied into every new entry.

The inactive-flow editor remains available for the flow name, start time,
ordered assignment, and individual expected durations. A focused `Edit time`
action is also available from a Control Room queue row while the flow is not
completed or archived. That focused update changes only the initiating
client's query cache and intentionally publishes no realtime event; other
clients observe it after their next reload. Existing order and lifecycle
changes retain their normal realtime invalidation.

## Overview interaction

- Multiple flows use a standalone vertical selector on the right of the
  overview component on desktop. It uses the application-sidebar background,
  while the timeline remains centered in the content area between the primary
  navigation and the flow sidebar. The flow sidebar fills the available
  viewport height below the tournament breadcrumb.
- Wheel and vertical touch gestures over that selector change the selected
  flow without scrolling the document.
- Opening a flow selects its current entry, or its first entry when it has no
  current cursor.
- Current and selected are separate states. The current marker remains visible
  after the user navigates away from it.
- One selected index drives both the timeline rail and the match-card track.
- Markers can be selected directly; arrow keys, buttons, and horizontal
  pointer/touch dragging navigate the cards.
- Smartphone dragging locks to the initially dominant axis so horizontal match
  navigation and vertical flow navigation do not interfere with one another.
- Marker, time-label, card scale, and opacity follow drag progress continuously.
- The selected card is centered and adjacent cards remain partially visible.
- Adjacent cards shrink substantially, and arrow controls sit above the card
  track so they never cover a neighboring match.
- Smartphone layouts hide the vertical flow selector but retain a compact
  horizontal timeline rail, reduce typography and spacing, and place a larger
  gesture hint below the card track: vertical swipes change flow and horizontal
  swipes change match.
- Every overview match card is rendered through the dedicated
  `ReadOnlyMatchCard` adapter with `controls={false}`. Permissions never enable
  editing from the overview.

## API and persistence

The Control Room flow DTO includes `willStartAt`; each entry includes
`expectedDurationMinutes`, `startedAt`, and `completedAt`.

```text
GET   /tournaments/:tournamentId/control-room/creation
POST  /tournaments/:tournamentId/control-room/flows
PATCH /control-room/flows/:flowId
PUT   /control-room/flows/:flowId/entries
PATCH /control-room/flows/:flowId/entries/:entryId/time
```

Creation data contains only currently unassigned matches. The create command
validates tournament ownership and match availability, then writes the flow
and entries in one PostgreSQL transaction. Order replacement preserves entries
that remain assigned instead of deleting and recreating the whole queue.

The incremental timing migration preserves existing pre-production flows. It
backfills their `willStartAt` with the migration time and their entry durations
with 30 minutes because the earlier schema contains no schedule from which
either value could be recovered. Actual timestamps remain null.

## V1 boundaries

V1 does not persist derived starts or estimates, broadcast focused duration
edits, predict durations, add schedule anchors or buffers, or provide timing
analytics. Actual timestamps intentionally provide the basis for later
analytics without introducing scheduling infrastructure now.
