# Project Instructions

## Project Purpose

Tournament Manager is a self-contained application for managing tournaments. The repository is an npm workspace monorepo containing only the NestJS backend, the React frontend, and integrations owned by the application.

## Scope and Requirements

- Keep the application isolated from the legacy container repository and unrelated projects.
- Maintain the backend in `apps/backend` and the frontend in `apps/frontend`.
- Keep application-owned integrations within the application that owns them. Start.gg and SyncStart integrations currently belong to the backend.
- Do not add Git submodules unless a future requirement explicitly justifies an external source dependency.
- Support independent backend and frontend builds and a complete local stack through Docker Compose.
- Use npm workspaces from the repository root.

## Language

- Communicate with the user in Italian unless the user explicitly requests another language.
- Perform all project work in English.
- Write all project documentation and project information in English.
- Write source code, comments, identifiers, configuration text, user-facing strings, commit messages, and other technical artifacts in English unless the user explicitly requests a different language for a specific deliverable.

## Documentation Index

- [Backend architecture and coding rules](.ai/Backend.md)
- [Frontend architecture and coding rules](.ai/Frontend.md)
- [Design system and design decisions](.ai/Design.md)

## Repository Architecture

- `apps/backend`: NestJS API, persistence, WebSocket gateways, and integrations.
- `apps/frontend`: React and Vite web application.
- `.ai`: Project architecture, coding, and design decisions.

No shared integration package is currently required. Shared packages may be introduced only when code is genuinely used by more than one application.

## NestJS Architecture

The backend uses the following architectural layers:

- **Controllers:** Define API routes and contain almost no application logic. Controllers encapsulate and delegate to services or managers. They must not access or inject repositories.
- **Controller routes:** Route inputs must be mapped through DTOs instead of individual native parameters. A native parameter is allowed only when the route accepts a single value, such as `id: number`.
- **Managers:** Implement application logic and complex orchestration. Managers must not access or inject repositories. They use the appropriate services whenever they need to retrieve or update database data. Managers also transform database entities into DTOs for the view.
- **Services:** Provide CRUD access to the database. Services encapsulate repositories and all database access, and return plain database entities that managers decouple from the presentation layer.
- **Entities:** Represent database entities.
- **Gateways:** Provide real-time view updates through WebSockets.
- **DTOs:** Define data exchanged with the view, both incoming and outgoing.
