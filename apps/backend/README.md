# Tournament Manager Backend

The backend is a NestJS application using PostgreSQL as its only persistence engine. TypeORM schema synchronization is disabled; application schema changes must be implemented as versioned migrations under `src/database/migrations`.

Run commands from the repository root unless noted otherwise.

## Development

Start PostgreSQL, Redis, and the migration runner, then start the backend and frontend watchers:

```text
npm run dev:dependencies
npm run dev
```

## Verification

```text
npm run test:unit
npm run test:e2e
npm run build --workspace=tournament_manager_backend
```

The e2e suite creates isolated PostgreSQL databases whose names end in `_test`, applies all migrations, and removes the databases after each suite.

## Migrations

Generate a migration after changing entity metadata:

```text
npm run migration:generate --workspace=tournament_manager_backend -- src/database/migrations/MigrationName
```

Review every generated migration before committing it. The complete local stack applies pending migrations automatically before the backend starts.
