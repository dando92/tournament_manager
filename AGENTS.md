# Project Instructions

## Agent Instruction Files

- `AGENTS.md` is the single source of truth for agent instructions in this repository. It applies to every coding agent, regardless of the tool that reads it.
- `CLAUDE.md` must contain only the `@AGENTS.md` import stub, so Claude Code loads this file automatically. Never duplicate instruction text in `CLAUDE.md`.
- Add every new project instruction, rule, or documentation index entry to `AGENTS.md` only.
- Tool-specific instructions also belong here. Mark them with the tool they apply to, and let other agents ignore them.
- Everything beyond `AGENTS.md`, `CLAUDE.md`, and ordinary product documentation (README, in-app help) lives outside this repository, in the external `tournament_manager-docs` repository cloned locally at `C:\.airepos\tournament_manager\`. See the global CLAUDE.md convention for how an agent locates that folder for any repository. The [Documentation Index](#documentation-index) below lists what it contains.

## Project Purpose

Tournament Manager is a self-contained, provider-independent application for managing tournaments. The repository is an npm workspace monorepo containing the application services, the React frontend, shared contracts, and application-owned integrations.

## Scope and Requirements

- Keep the application isolated from the legacy container repository and unrelated projects.
- Simplify the backend into independently deployable API, SyncStart, UI realtime, migration, and frontend applications.
- Keep application logic stateless; only connection adapters may keep volatile in-memory state.
- Use PostgreSQL as the authoritative transactional store and Redis Pub/Sub only for replaceable live-message fan-out.
- Keep application-owned integrations within the service that owns their lifecycle.
- Do not add Git submodules unless a future requirement explicitly justifies an external source dependency.
- Maintain a `local` configuration that starts the complete application stack with one command through Docker Compose.
- The `local` configuration must not require cloud services or provider-specific accounts.
- Use npm workspaces from the repository root.

## Pre-Production Evolution Policy

- The application is currently deployed only for testing and contains no production data.
- Until the user explicitly declares a production environment, prefer a clean implementation over database-upgrade compatibility, API compatibility layers, or legacy functional compatibility.
- Pre-production database schemas and data may be reset when an architectural change requires a new clean baseline.
- Once the user declares production use, replace this policy with explicit data-migration, API-compatibility, rollout, and rollback requirements before making breaking changes.

## Simplicity and Complexity Approval

- Keep the implementation as simple as reasonably possible for the approved requirements.
- Do not introduce substantial architectural or concurrency complexity speculatively. Explain the concrete need and obtain the user's approval before adding it.
- Handle concurrency caused by application scaling, service replicas, retries, and process failures. Do not add locking solely for rare overlaps between manual user operations unless the user explicitly approves that protection.

## Language

- Communicate with the user in Italian unless the user explicitly requests another language.
- Perform all project work in English.
- Write all project documentation and project information in English.
- Write source code, comments, identifiers, configuration text, user-facing strings, commit messages, and other technical artifacts in English unless the user explicitly requests a different language for a specific deliverable.

## Agent Tooling

### Formatting Discipline

- Preserve the existing formatting of every existing file. Make only the
  smallest formatting changes required around edited lines; never reformat a
  whole existing file as part of an unrelated functional change.
- New files and newly introduced blocks use four-space indentation, double
  quotes where Prettier controls quoting, semicolons, and trailing commas.
- Keep imports, function declarations, function calls, and their parameters on
  one line whenever reasonably possible. When a line must wrap, keep related
  parameters grouped instead of placing every parameter on its own line.
- Always put an `if` body on the following line and enclose it in braces. Do not
  use single-line `if` statements.
- The repository-root Prettier configuration defines defaults for new files.
  Do not run Prettier over an existing file when doing so would rewrite its
  established formatting.

## Documentation Index

Every file below lives in the external `tournament_manager-docs` repository, cloned locally at `C:\.airepos\tournament_manager\` — not in this repository.

- `Backend.md` — Backend architecture and coding rules
- `Architecture.md` — Application architecture and reliability rules
- `LocalOperations.md` — Local platform operations
- `NewPcSetup.md` — New PC setup guide
- `Deployment.md` — Continuous delivery and testing deployment
- `HostingOptions.md` — Hosting options and deferred hosted target
- `FunctionalQuestions.md` — Deferred functional questions
- `Frontend.md` — Frontend architecture and coding rules
- `Design.md` — Design system and design decisions
- `AdvancementRuleEditor.md` — Advancement rule editor and deferred quick-rule mode
- `SyncStartRefactoring.md` — SyncStart protocol refactoring decisions
- `LegacySyncStartBridge.md` — Legacy ITGmania SyncStart bridge
- `ScoringRefactoring.md` — Scoring model refactoring plan and decisions
- `ApiRefactoring.md` — API and frontend structure refactoring plan and decisions
- `ControlRoom.md` — Tournament Control Room flows and implementation plan
- `TournamentTimeline.md` — Tournament overview timeline and timing model
- `Tiebreaks.md` — Match tiebreak calculation, placement resolution, and responsive presentation
- `QueryAndSchemaOptimization.md` — Query style, index, and schema optimization plan
- `LobbyManagerSeparation.md` — Lobby manager and community event hub integration plan and decisions

## Repository Architecture

- `apps/api`: NestJS HTTP API, synchronous application entrypoints, and application-owned request/response integrations.
- `apps/migrations`: One-shot PostgreSQL migration runner, which also seeds the first administrator and, when explicitly enabled, the deterministic local fixture.
- `apps/syncstart`: Independently deployable SyncStart protocol, connector, and lobby-session service, including the deterministic local protocol simulator.
- `apps/realtime`: Independently deployable browser WebSocket, scoped fan-out, sequencing, and replaceable snapshot service.
- `apps/frontend`: Current React and Vite web application.
- `packages/scoring`: Scoring-system identifiers, pure score calculations, and their provider registry.
- `packages/contracts`: Transport-neutral SyncStart DTOs and internal HTTP request contracts.
- `packages/live-messaging`: Event envelopes, validation, publisher/subscriber ports, NestJS tokens, and Redis or in-memory transports.
- `packages/syncstart-protocol`: SyncStart WebSocket protocol client, lobby connection primitives, normalized protocol events, and deterministic simulator.
- `packages/persistence`: Shared PostgreSQL entity metadata and NestJS repository registration.
- `packages/startgg`: Provider-facing Start.gg client, GraphQL operations, types, parsing, pagination, and rate limiting.
- `tools/syncstart-simulator`: Deterministic SyncStart protocol simulator for local runs and tests.
- `tools/legacy-syncstart-bridge`: Compatibility adapter that presents a legacy UDP-broadcast ITGmania cabinet as a SyncStart lobby.

Project architecture, coding, and design decisions live in the external `tournament_manager-docs` repository — see [Documentation Index](#documentation-index).

The implemented structure and service boundaries are defined in `Architecture.md` there.

## Functional Question Tracking

Record every discovered ambiguity, suspected behavior defect, and unresolved product rule in `FunctionalQuestions.md`, in the external `tournament_manager-docs` repository (`C:\.airepos\tournament_manager\`). Characterize existing behavior and link supporting tests, but do not silently decide a functional question. Resolve functional changes only after the user approves the intended behavior.
