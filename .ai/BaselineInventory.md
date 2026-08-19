# Current Behavior and Migration Safety-Net Inventory

## Purpose

This document records the behavior that must remain available while the durable-event runtime is replaced. It is a Phase 0 inventory, not a target architecture specification. Target ownership remains defined in [Architecture.md](Architecture.md).

## HTTP Surface

The current API exposes these route groups:

- `auth`: password and local API-key login, current-account details, and permissions.
- `user`: registration, account listing, profile updates, and administrator-managed flags.
- `tournaments`: public discovery, creation, configuration, participants, staff roles, Start.gg import, and SyncStart lobby lifecycle.
- `divisions`, `phases`, and `phase-groups`: tournament structure, entrants, seeding, standings, and bracket generation.
- `players`: player discovery and division assignment.
- `songs`, `scores`, and `standings`: song catalog and recorded score management.
- `matches`: match creation, assignment, song selection, activation, result lifecycle, and queries by division or phase group.
- `advancement-rules` and `bracket`: advancement configuration and supported bracket types.

The route decorators in `apps/api/src` are the authoritative detailed inventory until internal HTTP contracts are extracted.

## Realtime Surface

The current runtime has three browser event families:

- UI updates publish `TournamentUpdate`, `DivisionUpdate`, `PhaseUpdate`, `PhaseGroupUpdate`, `MatchUpdate`, and `UiWarning`.
- Lobby updates publish SyncStart connection, lobby connection, song selection, and player readiness events scoped by tournament.
- Live match updates publish song selection, incremental match state, song completion, and disconnection state scoped by tournament.

`apps/realtime` is already the browser WebSocket endpoint. It receives replaceable messages through the existing Redis transport and maps them to these browser event families. Their names, tournament scope, and sequence behavior must remain compatible while the durable transport is replaced.

## Observer-Driven and Integration Behavior

- `apps/syncstart` owns current SyncStart connectors, lobby connection state, and protocol parsing.
- The SyncStart command consumer translates durable commands into session operations and publishes protocol outcomes.
- `apps/realtime` owns browser subscriptions, event routing, and replaceable snapshots.
- The Start.gg integration performs synchronous GraphQL request/response imports from tournament controllers.
- Completed-song persistence runs synchronously in the API. Redis Pub/Sub messages are replaceable telemetry and UI invalidations only.

## Critical User Journeys

The migration safety net must cover these journeys before their implementation moves:

1. Authenticate, create a tournament, and edit its configuration.
2. Add participants, divisions, phases, phase groups, and seed entrants.
3. Generate a bracket, create and assign matches, and advance completed results.
4. Add songs, persist scores, calculate standings, and reverse a recorded result.
5. Import a deterministic Start.gg event without contacting the external service.
6. Connect to a simulated SyncStart server, manage lobby state, and persist a completed song.
7. Receive scoped browser updates, reconnect, and restore authoritative state through HTTP.

## Automated Coverage Status

| Journey | Current coverage | Phase 0 action |
| --- | --- | --- |
| Authentication and tournament CRUD | Behavioral e2e baseline | Expand validation and authorization cases as needed |
| Participants and tournament structure | Behavioral e2e baseline | Expand only when a migrated slice requires it |
| Bracket and match workflow | Focused advancement, completion, reopening, and reversal unit coverage | Add behavioral persistence tests |
| Score persistence and standings | Focused calculation coverage and behavioral persistence coverage | Expand through complete match journeys |
| Start.gg import | Excluded by approved scope | Leave unchanged; decide future approach after migration |
| SyncStart lifecycle | Protocol connector and command-consumer unit tests; deterministic simulator coverage | Preserve normalized protocol inputs and completed-song behavior before Phase 2 |
| Browser realtime recovery | Realtime mapper unit tests and service-extraction e2e coverage | Preserve browser event names, tournament scope, and sequence behavior before Phase 3 |

The representative request and response inputs are stored in `apps/api/tests/fixtures/tournament-management.json`. Add focused characterization only when a planned simplification would otherwise lack coverage.
