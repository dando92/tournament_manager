# Project Instructions

## Project Purpose

Tournament Manager is a self-contained, provider-independent application for managing tournaments. The repository is an npm workspace monorepo containing the application services, the React frontend, shared contracts, and application-owned integrations.

## Scope and Requirements

- Keep the application isolated from the legacy container repository and unrelated projects.
- Migrate the current backend into independently deployable API, event processor, SyncStart, and UI realtime services.
- Keep application logic stateless; only connection adapters may keep volatile in-memory state.
- Use PostgreSQL as the authoritative transactional store and Redis as the provider-independent event transport.
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

## Documentation Index

- [Backend architecture and coding rules](.ai/Backend.md)
- [Target scalable architecture and migration rules](.ai/Architecture.md)
- [Incremental architecture migration work plan](.ai/MigrationPlan.md)
- [Migration execution status and next action](.ai/MigrationStatus.md)
- [Local platform operations](.ai/LocalOperations.md)
- [Current behavior and migration safety-net inventory](.ai/BaselineInventory.md)
- [Deferred functional questions](.ai/FunctionalQuestions.md)
- [Frontend architecture and coding rules](.ai/Frontend.md)
- [Design system and design decisions](.ai/Design.md)

## Repository Architecture

- `apps/backend`: Current NestJS backend and source of the migration.
- `apps/processor`: Independently deployable stateless event processor and outbox relay.
- `apps/frontend`: Current React and Vite web application.
- `packages/application`: Application logic shared by API and processor entrypoints.
- `packages/contracts`: Internal durable and live event contracts.
- `.ai`: Project architecture, coding, and design decisions.

The approved target structure and service boundaries are defined in `.ai/Architecture.md`. Do not treat the current directory structure as the target architecture.

## Migration Commit Authorization

Contributors and coding agents are authorized to create local Git commits during the migration without requesting separate confirmation for each commit. A commit may be created whenever it represents a coherent, reviewable checkpoint and the verification appropriate to its scope has passed. Do not commit known regressions, unrelated user changes, secrets, generated runtime data, or incomplete destructive transitions. Record the completed checkpoint and next action in `.ai/MigrationStatus.md` before or as part of the commit.

## Functional Question Tracking

Record every discovered ambiguity, suspected behavior defect, and unresolved product rule in `.ai/FunctionalQuestions.md`. During the architecture migration, characterize existing behavior and link supporting tests, but do not silently decide a functional question. Functional changes are deferred until after the architectural migration unless the user explicitly prioritizes one earlier.
