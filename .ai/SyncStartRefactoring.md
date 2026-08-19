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

- `SyncStartClient` is the protocol-level coordinator for one tournament and SyncStart server URL. It creates, indexes, removes, and shuts down server and lobby session objects without mutating their internal state.
- `SyncStartServerSession` owns the server WebSocket connection, connection-status lifecycle, pending lobby-search correlation, timeout, and protocol response parsing.
- `LobbySession` owns exactly one lobby: its create/spectate mode, credentials, identity, initial connection correlation, per-lobby WebSocket connection, connection lifecycle, protocol message handling, and volatile lobby state.
- `LobbyStateInterpreter` receives `lobbyState` snapshots for one session and turns state transitions into normalized events. It owns detection of selected songs, player readiness, gameplay updates, completed songs, and duplicate-completion suppression.
- `LobbyConnection` owns the low-level WebSocket lifecycle, serialized message delivery, timeout, and optional reconnect behavior.
- `LobbyEventDispatcher` forwards normalized protocol events to supplied observers. It does not know application services.

## Application Object Model

- `InternalController` is the HTTP adapter only. It validates the internal token and delegates directly to application classes; no command-handler layer is required.
- `TournamentSyncStartRegistry` maps `tournamentId` to one replica-local `TournamentSyncStartRuntime`. It owns configuration, lookup, replacement, and shutdown only.
- `TournamentSyncStartRuntime` binds one tournament identity and configuration to its protocol client, application observers, and lobby catalog.
- `LobbyCatalog` is a volatile in-memory query projection owned by one tournament runtime. It merges observed-lobby metadata with remote lobby-search results and never opens connections.
- `SyncStartEventsPublisher` publishes replaceable live telemetry only.
- `CompletedSongSubmitter` submits completed songs to the internal API only.

## Testability Decisions

- Protocol state interpretation must be unit-testable without a real WebSocket.
- `LobbyConnection` must receive a WebSocket factory so it can be tested with a fake transport.
- `LobbySession` and `SyncStartServerSession` must propagate the injected WebSocket factory to every connection they own.
- `TournamentSyncStartRegistry` receives its SyncStart client factory through an explicit NestJS token so runtime creation can be tested with fake clients and production wiring is unambiguous.
- Deterministic simulators are development and test tools, not runtime package exports or application source. The local simulator lives in `tools/syncstart-simulator`; protocol test helpers must not be compiled into the protocol package.
- Protocol simulator tests are boundary tests. They complement, but do not replace, unit tests for `LobbyStateInterpreter`, `LobbySession`, `LobbyConnection`, and `SyncStartClient`.

## Build Output

`dist` is generated output and must never be edited or reviewed as source. Build commands must clean the target output directory before compilation so moved or deleted source files cannot remain as stale artifacts.

## Implementation Record

- `LobbyStateInterpreter` owns snapshot normalization, transition detection, and duplicate-completion suppression.
- `LobbySession` encapsulates all mutable state and valid transitions associated with a single create or spectate lifecycle; `SyncStartClient` only maps lobby codes to sessions and responds to their lifecycle notifications.
- `SyncStartServerSession` encapsulates server status and pending lobby searches instead of leaving that state in the coordinator.
- `LobbyConnection` accepts a WebSocket factory, every session propagates it, and `TournamentSyncStartRegistry` receives an explicitly provided SyncStart-client factory.
- The application currently has one state-owning SyncStart replica. A future horizontal deployment partitions ownership by `tournamentId`; distributed routing and failover are intentionally not implemented yet.
- Build scripts remove `dist` before compiling and the architecture check protects the simulator's protocol-package boundary.
- Focused unit coverage includes catalog projection and state interpretation; simulator tests remain protocol boundary tests.
