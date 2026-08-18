# Backend Architecture and Coding Rules

## NestJS Architecture

The backend uses the following architectural layers:

- **Controllers:** Define API routes and contain almost no application logic. Controllers encapsulate and delegate to services or managers. They must not access or inject repositories.
- **Controller routes:** Route inputs must be mapped through DTOs instead of individual native parameters. A native parameter is allowed only when the route accepts a single value, such as `id: number`.
- **Managers:** Implement application logic and complex orchestration. Managers must not access or inject repositories. They use the appropriate services whenever they need to retrieve or update database data. Managers also transform database entities into DTOs for the view.
- **Services:** Provide CRUD access to the database. Services encapsulate repositories and all database access, and return plain database entities that managers decouple from the presentation layer.
- **Entities:** Represent database entities.
- **Gateways:** Provide real-time view updates through WebSockets.
- **DTOs:** Define data exchanged with the view, both incoming and outgoing.

## Maintainability

- Prefer the smallest explicit implementation that satisfies the current requirement.
- Keep classes, functions, fixtures, and test helpers focused and locally understandable.
- Use descriptive names and straightforward control flow instead of implicit conventions or premature generic abstractions.
- Extract shared code only when it removes real duplication or establishes an approved architectural boundary.
- Keep characterization tests readable as behavior documentation for future maintainers.
- Do not mix architectural migration with unrelated cleanup or functional changes.

## Technologies

- Node.js 22
- TypeScript
- NestJS 11
- TypeORM
- PostgreSQL-compatible persistence
- Redis Streams for durable event transport
- Redis Pub/Sub for replaceable live events
- PostgreSQL is the only supported database in the target architecture.
- SQLite and MariaDB configuration, dependencies, adapters, and migration paths are not supported.
- TypeORM schema synchronization is disabled in every environment. Versioned PostgreSQL migrations are the only application-schema mechanism.
- The initial migration targets an empty pre-production database. Existing test databases are reset instead of carrying compatibility code into the baseline.
- Native WebSockets through NestJS gateways

## Location and Integrations

The current backend is located in `apps/backend` and is the source of the service extraction defined in `Architecture.md`. Its current module boundaries must not be treated as final deployment boundaries.

Local configuration is loaded from the repository-root `.env` file. The `local` configuration must start the complete application and its PostgreSQL and Redis dependencies through Docker Compose without requiring cloud services. Local startup requirements are defined in [Architecture.md](Architecture.md).

## Health and Local Bootstrap

- `GET /health/live` reports process liveness and must not depend on external services.
- `GET /health/ready` reports PostgreSQL, Redis, and migration-runner readiness separately and returns HTTP `503` while any required dependency is unavailable.
- Docker Compose runs the migration entrypoint to completion before starting the backend.
- The migration runner applies versioned application-schema migrations before backend startup, and readiness remains unavailable if it does not complete.
- Optional local seed data must be deterministic and idempotent. It is enabled only through `LOCAL_SEED_ENABLED=true`.
- Operational procedures are defined in [LocalOperations.md](LocalOperations.md).

## Target Backend Boundaries

The approved target separates API, stateless event processing, SyncStart connections, and UI realtime delivery. Detailed ownership, event flows, reliability rules, and migration order are defined in [Architecture.md](Architecture.md).

Managers remain application-layer use cases. Event handlers in the processor may invoke managers or services but must not access repositories directly.
