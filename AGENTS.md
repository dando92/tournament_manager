# Project Instructions

## Agent Instruction Files

- `AGENTS.md` is the single source of truth for agent instructions in this repository. It applies to every coding agent, regardless of the tool that reads it.
- `CLAUDE.md` must contain only the `@AGENTS.md` import stub, so Claude Code loads this file automatically. Never duplicate instruction text in `CLAUDE.md`.
- Add every new project instruction, rule, or documentation index entry to `AGENTS.md` only.
- Tool-specific instructions also belong here. Mark them with the tool they apply to, and let other agents ignore them.

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

### graphify (Claude Code)

This project has a knowledge graph at `graphify-out/` with god nodes, community structure, and cross-file relationships.

- For codebase questions, first run `graphify query "<question>"` when `graphify-out/graph.json` exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than `GRAPH_REPORT.md` or raw grep output.
- If `graphify-out/wiki/index.md` exists, use it for broad navigation instead of raw source browsing.
- Read `graphify-out/GRAPH_REPORT.md` only for broad architecture review or when query, path, and explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Documentation Index

- [Backend architecture and coding rules](.ai/Backend.md)
- [Target scalable architecture and migration rules](.ai/Architecture.md)
- [Incremental architecture migration work plan](.ai/MigrationPlan.md)
- [Migration execution status and next action](.ai/MigrationStatus.md)
- [Local platform operations](.ai/LocalOperations.md)
- [Continuous delivery and testing deployment](.ai/Deployment.md)
- [Hosting options and deferred hosted target](.ai/HostingOptions.md)
- [Current behavior and migration safety-net inventory](.ai/BaselineInventory.md)
- [Deferred functional questions](.ai/FunctionalQuestions.md)
- [Frontend architecture and coding rules](.ai/Frontend.md)
- [Design system and design decisions](.ai/Design.md)
- [SyncStart protocol refactoring decisions](.ai/SyncStartRefactoring.md)
- [Scoring model refactoring plan and decisions](.ai/ScoringRefactoring.md)
- [API and frontend structure refactoring plan and decisions](.ai/ApiRefactoring.md)

## Repository Architecture

- `apps/api`: NestJS HTTP API, synchronous application entrypoints, and application-owned request/response integrations.
- `apps/migrations`: One-shot PostgreSQL migration runner.
- `apps/local-fixtures`: Optional one-shot local fixture application.
- `apps/syncstart`: Independently deployable SyncStart protocol, connector, and lobby-session service, including the deterministic local protocol simulator.
- `apps/realtime`: Independently deployable browser WebSocket, scoped fan-out, sequencing, and replaceable snapshot service.
- `apps/frontend`: Current React and Vite web application.
- `packages/scoring`: Scoring-system identifiers, pure score calculations, and their provider registry.
- `packages/contracts`: Transport-neutral SyncStart DTOs and internal HTTP request contracts.
- `packages/live-messaging`: Event envelopes, validation, publisher/subscriber ports, NestJS tokens, and Redis or in-memory transports.
- `packages/syncstart-protocol`: SyncStart WebSocket protocol client, lobby connection primitives, normalized protocol events, and deterministic simulator.
- `packages/persistence`: Shared PostgreSQL entity metadata and NestJS repository registration.
- `packages/startgg`: Provider-facing Start.gg client, GraphQL operations, types, parsing, pagination, and rate limiting.
- `.ai`: Project architecture, coding, and design decisions.

The implemented structure and service boundaries are defined in `.ai/Architecture.md`.

## Migration Commit Authorization

Contributors and coding agents are authorized to create local Git commits during the migration without requesting separate confirmation for each commit. A commit may be created whenever it represents a coherent, reviewable checkpoint and the verification appropriate to its scope has passed. Do not commit known regressions, unrelated user changes, secrets, generated runtime data, or incomplete destructive transitions. Record the completed checkpoint and next action in `.ai/MigrationStatus.md` before or as part of the commit.

## Functional Question Tracking

Record every discovered ambiguity, suspected behavior defect, and unresolved product rule in `.ai/FunctionalQuestions.md`. During the architecture migration, characterize existing behavior and link supporting tests, but do not silently decide a functional question. Functional changes are deferred until after the architectural migration unless the user explicitly prioritizes one earlier.
