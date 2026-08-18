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

## Language

- Communicate with the user in Italian unless the user explicitly requests another language.
- Perform all project work in English.
- Write all project documentation and project information in English.
- Write source code, comments, identifiers, configuration text, user-facing strings, commit messages, and other technical artifacts in English unless the user explicitly requests a different language for a specific deliverable.

## Documentation Index

- [Backend architecture and coding rules](.ai/Backend.md)
- [Target scalable architecture and migration rules](.ai/Architecture.md)
- [Incremental architecture migration work plan](.ai/MigrationPlan.md)
- [Frontend architecture and coding rules](.ai/Frontend.md)
- [Design system and design decisions](.ai/Design.md)

## Repository Architecture

- `apps/backend`: Current NestJS backend and source of the migration.
- `apps/frontend`: Current React and Vite web application.
- `.ai`: Project architecture, coding, and design decisions.

The approved target structure and service boundaries are defined in `.ai/Architecture.md`. Do not treat the current directory structure as the target architecture.
