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
- The API command files, `apps/api/src/**/*.commands.ts`, are the reference for
  how code is written here. New code and refactored code follow them.
- New files and newly introduced blocks use four-space indentation, single
  quotes, semicolons, and trailing commas.
- Keep imports, function declarations, function calls, and their parameters on
  one line whenever reasonably possible. When a line must wrap, keep related
  parameters grouped instead of placing every parameter on its own line.
- Always put an `if` body on the following line and enclose it in braces. Do not
  use single-line `if` statements. This rule wins over the reference files,
  which predate it and still contain single-line `if` statements: give one
  braces when you edit its line, and never copy the shape into new code.
- The repository-root Prettier configuration matches the reference files and
  supplies the remaining defaults, including the 160-column print width. It is
  not applied to the repository as a whole: several workspaces still use double
  quotes, and `npm run format` would rewrite every one of them. Do not run
  Prettier over an existing file when doing so would rewrite its established
  formatting; let a file converge when it is edited for another reason.

## Documentation Index

Every file below lives in the external `tournament_manager-docs` repository, cloned locally at `C:\.airepos\tournament_manager\` — not in this repository.

That repository holds two kinds of document, and the difference decides what happens to one.

- **What the system is, and what was decided about it.** These are permanent. A decision is recorded where the rule lives, not in the document that happened to produce it.
- **A plan.** A plan is scaffolding for work in progress and lives only as long as that work does. When it is finished, whatever it decided about the system moves into the documents above, and the plan is deleted — git history keeps the account of how the work was done, and a finished plan left in place turns into a description of a system that has moved on.

How the system works, and what was decided:

- `Architecture.md` — Application architecture, service boundaries, and reliability rules
- `Backend.md` — Backend architecture and coding rules: aggregates, projections, database access, responses, naming
- `Frontend.md` — Frontend architecture and coding rules
- `Design.md` — Design system and design decisions
- `Schedule.md` — Schedules: lifecycle, runner, eligibility, persistence, timing, API surface, and the two pages that read them
- `Scoring.md` — Rounds, standings and scores, the scoring strategies, and the deferred mixed-round design
- `Stats.md` — The statistics page: how a final placement is read off the advancement graph, and what each section measures
- `Tiebreaks.md` — Match tiebreak calculation, placement resolution, and responsive presentation
- `AdvancementRuleEditor.md` — Advancement rule editor and deferred quick-rule mode
- `SyncStart.md` — SyncStart protocol package and session ownership
- `LegacySyncStartBridge.md` — Legacy ITGmania SyncStart bridge
- `mockups/schedule-restructure/` — Approved reference views behind the schedule board and Control Room
- `mockups/structure-builder/` — Approved reference views behind the Structure page
- `mockups/page-notice/` — Approved reference views behind the page notice slot and the five destinations a message can have
- `mockups/stats-page/` — Proposed views for the statistics page: two directions on how much colour it may carry, and what each would cost

Operations:

- `LocalOperations.md` — Local platform operations
- `NewPcSetup.md` — New PC setup guide
- `Deployment.md` — Continuous delivery and testing deployment
- `HostingOptions.md` — Hosting options and deferred hosted target

Open work:

- `FunctionalQuestions.md` — The functional backlog: deferred questions, and the answered ones with the decision that closed them
- `PerformanceReadiness.md` — Active plan: write path, live-update fan-out, load measurement, and the schema change to make before production
- `LobbyManagerSeparation.md` — Lobby manager and community event hub integration: design intent, nothing implemented

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
- `tools/dataset-seeder`: Deterministic bulk seeder that writes a database worth measuring, in the `venue`, `season`, and `stress` profiles.

Project architecture, coding, and design decisions live in the external `tournament_manager-docs` repository — see [Documentation Index](#documentation-index).

The implemented structure and service boundaries are defined in `Architecture.md` there.

## Functional Question Tracking

Record every discovered ambiguity, suspected behavior defect, and unresolved product rule in `FunctionalQuestions.md`, in the external `tournament_manager-docs` repository (`C:\.airepos\tournament_manager\`). Characterize existing behavior and link supporting tests, but do not silently decide a functional question. Resolve functional changes only after the user approves the intended behavior.
