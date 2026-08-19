# SyncStart Protocol Refactoring Decisions

## Status

The refactoring is implemented. This document is the authoritative record of the agreed design. Source code, not generated `dist` output, is the only valid basis for implementation review.

## Package Boundary

`@tournament-manager/syncstart-protocol` owns only the external SyncStart protocol adapter. It must not depend on NestJS, Redis, HTTP, application configuration, tournament storage, or application services.

The package owns:

- WebSocket transport primitives;
- the server connection and lobby connections required by the SyncStart protocol;
- protocol DTOs and parsing;
- normalized lobby events.

The package must preserve the existing protocol connection topology: one server WebSocket connection and a separate WebSocket connection for each created or observed lobby. This is treated as a SyncStart protocol requirement, not an application-level optimization opportunity.

## Protocol Object Model

- `SyncStartClient` is the protocol-level supervisor for one SyncStart server URL. It connects to the server, searches lobbies, creates or removes lobby sessions, and routes protocol messages. It must not interpret gameplay state or own per-lobby state transitions.
- `LobbySession` owns exactly one lobby: its create/spectate mode, credentials, identity, per-lobby WebSocket connection, connection lifecycle, and volatile lobby state.
- `LobbyStateInterpreter` receives `lobbyState` snapshots for one session and turns state transitions into normalized events. It owns detection of selected songs, player readiness, gameplay updates, completed songs, and duplicate-completion suppression.
- `LobbyConnection` owns the low-level WebSocket lifecycle, serialized message delivery, timeout, and optional reconnect behavior.
- `LobbyEventDispatcher` forwards normalized protocol events to supplied observers. It does not know application services.

## Application Object Model

- `InternalController` is the HTTP adapter only. It validates the internal token and delegates directly to application classes; no command-handler layer is required.
- `TournamentSyncStartRegistry` maps `tournamentId` to one `SyncStartClient`. It owns configuration, lookup, and shutdown of protocol clients for the SyncStart application.
- `LobbyCatalog` is a volatile in-memory query projection updated from protocol lifecycle events. It merges observed-lobby metadata with remote lobby-search results and never opens connections.
- `SyncStartEventsPublisher` publishes replaceable live telemetry only.
- `CompletedSongSubmitter` submits completed songs to the internal API only.

## Testability Decisions

- Protocol state interpretation must be unit-testable without a real WebSocket.
- `LobbyConnection` must receive a WebSocket factory so it can be tested with a fake transport.
- `TournamentSyncStartRegistry` must receive a SyncStart client factory so it can be tested with fake clients.
- Deterministic simulators are development and test tools, not runtime package exports or application source. The local simulator lives in `tools/syncstart-simulator`; protocol test helpers must not be compiled into the protocol package.
- Protocol simulator tests are boundary tests. They complement, but do not replace, unit tests for `LobbyStateInterpreter`, `LobbySession`, `LobbyConnection`, and `SyncStartClient`.

## Build Output

`dist` is generated output and must never be edited or reviewed as source. Build commands must clean the target output directory before compilation so moved or deleted source files cannot remain as stale artifacts.

## Implementation Record

- `LobbyStateInterpreter` owns snapshot normalization, transition detection, and duplicate-completion suppression.
- `LobbySession` contains the state and per-lobby transport associated with a single create or spectate lifecycle; `SyncStartClient` supervises the server connection and maps lobby codes to sessions.
- `LobbyConnection` accepts a WebSocket factory and `TournamentSyncStartRegistry` accepts a SyncStart-client factory, enabling isolated tests.
- Build scripts remove `dist` before compiling and the architecture check protects the simulator's protocol-package boundary.
- Focused unit coverage includes catalog projection and state interpretation; simulator tests remain protocol boundary tests.
