# Current Behavior and Migration Safety-Net Inventory

## Purpose

This document records the behavior that must remain available while the monolithic backend is migrated. It is a Phase 0 inventory, not a target architecture specification. Target ownership remains defined in [Architecture.md](Architecture.md).

## HTTP Surface

The current NestJS backend exposes these route groups:

- `auth`: password and local API-key login, current-account details, and permissions.
- `user`: registration, account listing, profile updates, and administrator-managed flags.
- `tournaments`: public discovery, creation, configuration, participants, staff roles, Start.gg import, and SyncStart lobby lifecycle.
- `divisions`, `phases`, and `phase-groups`: tournament structure, entrants, seeding, standings, and bracket generation.
- `players`: player discovery and division assignment.
- `songs`, `scores`, and `standings`: song catalog and recorded score management.
- `matches`: match creation, assignment, song selection, activation, result lifecycle, and queries by division or phase group.
- `advancement-rules` and `bracket`: advancement configuration and supported bracket types.

The route decorators in `apps/backend/src` are the authoritative detailed inventory until versioned HTTP contracts are introduced.

## Realtime Surface

The backend currently owns three native WebSocket gateways:

- UI updates publish `TournamentUpdate`, `DivisionUpdate`, `PhaseUpdate`, `PhaseGroupUpdate`, `MatchUpdate`, and `UiWarning`.
- Lobby updates publish SyncStart connection, lobby connection, song selection, and player readiness events scoped by tournament.
- Live match updates publish song selection, incremental match state, song completion, and disconnection state scoped by tournament.

These messages are process-local broadcasts and are not yet versioned contracts. They must remain in place until the Phase 7 replacement passes parity and recovery tests.

## Observer-Driven and Integration Behavior

- `LobbyManager` owns current SyncStart connector and lobby connection state.
- `StandingManager`, `LobbyGateway`, and `LiveMatchGateway` observe SyncStart lobby events.
- `UiUpdateGateway` broadcasts changes invoked by current match workflows.
- The Start.gg integration performs synchronous GraphQL request/response imports from tournament controllers.
- No Redis transport, transactional outbox, consumer inbox, bounded retry, or dead-letter handling exists yet.

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
| Participants and tournament structure | Not covered | Add behavioral e2e coverage |
| Bracket and match workflow | Focused advancement, completion, reopening, and reversal unit coverage | Add behavioral persistence tests |
| Score persistence and standings | Focused scoring and standing-orchestration unit coverage | Add behavioral persistence coverage |
| Start.gg import | Not covered | Add deterministic HTTP stub and fixtures |
| SyncStart lifecycle | Focused lobby-state orchestration unit coverage | Add deterministic protocol simulator |
| Browser realtime recovery | Not covered | Add fixtures now; complete recovery coverage in Phase 7 |

The first representative request and response inputs are stored in `apps/backend/test/fixtures/tournament-management.json`. Additional parity fixtures must be added with each protected vertical slice.
