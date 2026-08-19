# Continuous Delivery and Testing Deployment

## Scope and Target

The current deployment is pre-production and contains no production data. GitHub Actions is the release control plane, GitHub Container Registry stores immutable images, and the `testing` GitHub environment deploys to the existing self-hosted Docker runner. This target has no provider-specific application dependency and can run on a free self-hosted machine or free-tier Docker host.

The deployment adapter is [deploy/docker-compose.yml](../deploy/docker-compose.yml). It runs pinned PostgreSQL and Redis containers with named volumes and consumes API, processor, SyncStart, realtime, and frontend images tagged only with the Git commit SHA. A reverse proxy or tunnel may expose the loopback-bound API, realtime, and frontend ports; that edge component is outside the application contract.

Production is not declared. Before production use, replace the pre-production reset/restore policy with approved forward-migration, compatibility, backup-retention, rollback, and disaster-recovery requirements.

## Required GitHub Configuration

Create a `testing` environment and configure these secrets:

- `DATABASE_PASSWORD`
- `LOCAL_API_KEY`
- `JWT_SECRET`

Configure these environment variables:

- `CORS_ORIGINS`
- `PUBLIC_API_URL`
- `PUBLIC_REALTIME_URL`
- optionally `AUTH_MODE`, `DATABASE_USER`, `DATABASE_NAME`, bind address, public smoke URLs, and exposed ports listed in [deploy/.env.example](../deploy/.env.example)

The self-hosted runner must have Node.js 22, Docker Engine or Docker Desktop, Docker Compose, Bash, persistent Docker volumes, and permission to pull repository packages from GHCR.

Protect `main` in GitHub repository settings and require both `Required verification` and `Production-equivalent local stack` before merge. Repository files define these checks, but GitHub branch protection remains an external repository setting and must be enabled once per repository.

## Pipeline

Pull requests to `main` run:

1. clean `npm ci` installation;
2. architecture and delivery-contract checks;
3. lint and TypeScript checks;
4. contract and app unit tests;
5. PostgreSQL/Redis e2e tests and all workspace builds;
6. a second production-equivalent Docker Compose startup followed by integration, e2e, health, migration, Swagger, seed, realtime-replica, and frontend checks.

A merge to `main` can continue only after both verification jobs pass. It builds and publishes five GHCR images with the full commit SHA as their only release tag. No `latest`, branch, or environment tag is published.

The testing promotion then:

1. captures the currently running immutable API image tag;
2. pulls the exact new SHA-tagged images;
3. starts PostgreSQL and Redis;
4. creates a transient pre-migration database backup;
5. runs the API migration entrypoint once;
6. replaces processor, SyncStart, both realtime replicas, API, and frontend in dependency order;
7. waits for readiness and runs public smoke tests;
8. deletes the transient backup after success.

Frontend endpoint and authentication settings are written to `runtime-config.js` when its container starts. They are not compiled into the image, so the published frontend digest is portable between the local and testing configurations.

## Failure and Rollback

- A pull, dependency-start, or validation failure before the backup does not replace application services.
- A migration failure prevents application rollout.
- A failed readiness or smoke check stops the failed release, recreates the pre-migration database from the transient backup, redeploys the previously captured SHA, and smoke-tests that restored release.
- A failed first promotion has no previous image. The workflow stops application services and restores the pre-migration database, leaving no failed release promoted.
- The backup is removed after the recovery attempt or successful promotion so repository workspaces and artifacts do not retain application data.

If automatic rollback itself fails, leave PostgreSQL and Redis running, keep application services stopped, inspect the failed job and container logs, and rerun the previous SHA through the same Compose adapter after restoring a trusted backup. Do not retag an image or rebuild the old commit.

## Manual Validation

Validate deployment configuration without starting services:

```text
docker compose --env-file deploy/.env.example -f deploy/docker-compose.yml config --quiet
```

Run public smoke checks against a deployment:

```text
DEPLOY_API_URL=http://127.0.0.1:3000 \
DEPLOY_REALTIME_URL=http://127.0.0.1:3003 \
DEPLOY_FRONTEND_URL=http://127.0.0.1:8080 \
node scripts/smoke-deployment.mjs
```
