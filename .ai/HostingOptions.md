# Hosting Options

## Status

No hosted target is selected. The next tournament runs the complete stack from the repository-root Compose configuration on an operator machine, exposed through an external tunnel when remote access is required.

Render is recorded here as the candidate hosted target for later, together with the changes it would require. Nothing in this document is implemented.

## Constraint That Decides the Target

`Tournament.syncstartUrl` is per-tournament configuration and may address either a public SyncStart server or one reachable only on the venue network. SyncStart owns the outbound protocol WebSocket, so a hosted SyncStart cannot serve a tournament whose server is venue-local.

A hosted target therefore covers tournaments with a publicly reachable SyncStart server. The operator-machine target remains required for venue-local ones, and both targets must be kept working if both tournament kinds are expected.

## Render Model

Free instances spin down after fifteen minutes without inbound traffic and take about a minute to spin back up. Compute on paid instance types is billed per second. The intended model is therefore: keep the services on free instances between tournaments, move them to a paid instance type before an event, and return them to free instances afterwards.

Two consequences of spin-down belong to the operating procedure, not to the application:

- SyncStart's protocol work is outbound. Inbound traffic never keeps it awake, so on a free instance it stays suspended except while the API calls it.
- A restart rebuilds tournament runtimes through `TournamentBootstrapService`, but configuration is not connection: the SyncStart server session and every lobby connection remain explicit operator commands. Move the services to paid instances before the event rather than during it.

## Service Mapping

- API, SyncStart, and Realtime become web services built from their existing Dockerfiles. One Realtime instance replaces the two local replicas. This does not relax the local contract: the local stack keeps two replicas because they verify replica convergence, and `check-architecture` enforces that.
- The frontend stays on its current static host and keeps pointing at the hosted API and Realtime URLs.
- PostgreSQL is external. Render's free PostgreSQL instance expires and is not used.
- Redis uses a hosted key-value instance. A free tier that keeps data in memory only and empties it on restart is acceptable: Redis carries replaceable live messages only.
- Migrations run as the API service's pre-deploy command instead of a one-shot Compose service.

## Required Changes

1. **Redis credentials.** Done for the transport: `createRedisClient` accepts `REDIS_URL` and falls back to `REDIS_HOST` and `REDIS_PORT`, which the local stack keeps using. Still open for readiness: each service probes Redis with a plaintext `PING` over a raw TCP socket, so a TLS endpoint or one that requires authentication will report the service as not ready even when the transport connects. The probe must move to an authenticated client call before a hosted Redis is used.
2. **Internal HTTP timeout.** `INTERNAL_HTTP_TIMEOUT_MS` defaults to five seconds in `HttpSyncStartClient`. A suspended free instance takes thirty to sixty seconds to spin up, so the first API call to a suspended SyncStart fails. Raise the timeout for the hosted target, or keep SyncStart on a paid instance whenever a tournament is configured.
3. **Internal service addressing.** `API_INTERNAL_URL` and `SYNCSTART_INTERNAL_URL` must carry the services' public HTTPS URLs. Confirm whether the selected plan provides private networking before relying on it; without it, internal calls traverse the public internet protected only by `INTERNAL_SERVICE_TOKEN`.
4. **Database configuration.** Set `DATABASE_SSL` to `true` and use the provider's pooled endpoint. The application already supports both; only configuration changes.
5. **Service definition.** Add a provider blueprint describing the three web services, their Docker builds, the `/health/ready` health-check path, the key-value instance, and the API pre-deploy migration command. `deploy/docker-compose.yml` is not used by this target and remains the adapter for a single-host deployment.
6. **Delivery pipeline.** `deploy-testing` promotes a release by running Compose on a self-hosted runner. A hosted target replaces it with per-service deploy triggers. `scripts/check-architecture.mjs` asserts the `Apply migrations once`, `Smoke test release`, and `Roll back failed promotion` stages by name, so the check, the workflow, and [Deployment](Deployment.md) must be updated together.
7. **Frontend endpoints and CORS.** `CORS_ORIGINS` must list the frontend origin, and the frontend build must point at the hosted API and Realtime URLs.

## Cost Shape

Between tournaments the hosted services are suspended and cost nothing. During a tournament, three paid web-service instances are billed for the hours they run. Returning the services to free instances after the event is an explicit operator step and does not happen automatically.
