# New PC Setup Guide

This guide installs the complete local Tournament Manager stack on a new PC. It covers the Docker-based application, the legacy ITGmania SyncStart bridge, and optional public browser access through a temporary Cloudflare Tunnel.

## 1. Install prerequisites

Install:

- Git
- Node.js 22 or later, including npm
- Docker Desktop with Docker Compose v2
- `cloudflared` only when remote browser access is required

On Windows, start Docker Desktop and wait until its engine is ready. Keep the PC on the same local network as the ITGmania cabinets when using the legacy bridge.

Verify the tools from PowerShell:

```powershell
git --version
node --version
npm --version
docker --version
docker compose version
```

## 2. Clone and install the project

```powershell
git clone https://github.com/dando92/tournament_manager.git
Set-Location tournament_manager
npm ci
```

Run `npm ci` again after pulling a change to `package-lock.json`.

## 3. Create the local environment file

Create `.env` from the tracked template:

```powershell
Copy-Item .env.example .env
```

At minimum, replace these development defaults with private values before exposing the application outside the PC:

```dotenv
INITIAL_ADMIN_PASSWORD=choose-a-private-admin-password
JWT_SECRET=choose-a-long-random-secret
INTERNAL_SERVICE_TOKEN=choose-another-long-random-secret
```

Keep these gateway values unchanged:

```dotenv
PUBLIC_API_URL=/api/
PUBLIC_REALTIME_URL=/realtime/
```

The relative paths make the browser configuration independent of the PC name, local IP address, and temporary tunnel URL. Docker Compose supplies its own internal container addresses, while host development uses the loopback addresses already present in the template.

The same `.env` can therefore be copied securely to another PC for an equivalent setup. Check only that its configured host ports are free. Copying `.env` does not copy PostgreSQL data, and the file contains credentials and secrets, so never commit it or send it through an untrusted channel. For a separate fresh installation, generating new secrets is preferable.

## 4. Start the complete stack

For normal browser use without legacy cabinets:

```powershell
npm run local:up
```

For legacy ITGmania cabinets, use this instead:

```powershell
npm run local_sync:up
```

`local_sync:up` starts the Docker stack and then runs the legacy SyncStart bridge on the host. Keep that PowerShell window open: the bridge stays in the foreground and displays cabinet events. If Windows Firewall asks for permission, allow Node.js on private networks so UDP broadcasts from the cabinets can reach the bridge.

Open the application at `http://localhost`. Sign in with `INITIAL_ADMIN_USERNAME` and `INITIAL_ADMIN_PASSWORD` from `.env`.

For a tournament using the legacy bridge, set its SyncStart URL to:

```text
ws://host.docker.internal:1337
```

Then connect SyncStart from the tournament header. The bridge lobby uses `LEGACY_BRIDGE_LOBBY_CODE`, which defaults to `BRDG`.

## 5. Verify the installation

Check container health:

```powershell
npm run local:status
```

Basic browser-gateway checks:

```powershell
Invoke-RestMethod http://localhost/api/health/live
Invoke-RestMethod http://localhost/realtime/health/live
```

Both health endpoints must report an `ok` status. The full project verification is more thorough and takes longer:

```powershell
npm run verify:local
```

To test the cabinet bridge, play a song and watch its foreground logs. A received session reports `Song session started`; a completed result reports `Song completed`. If no bridge log appears, verify that the PC and cabinets are on the same LAN and that UDP port `53000` is allowed through the private-network firewall.

## 6. Optional public browser access

With the stack running, expose only the Nginx frontend gateway:

```powershell
cloudflared tunnel --url http://localhost
```

Open the HTTPS URL printed by `cloudflared`. API requests and realtime WebSockets use that same origin through `/api/` and `/realtime/`. A new temporary tunnel URL requires no `.env` change, no Vite configuration, and no rebuild.

The tunnel does not expose PostgreSQL, Redis, SyncStart, or the legacy bridge. The bridge continues to communicate with cabinets over the venue LAN.

## 7. Stop, restart, and inspect logs

Stop the bridge with `Ctrl+C`. This leaves the detached Docker services running. Stop them without deleting data with:

```powershell
npm run local:down
```

Start them again with `npm run local:up` or `npm run local_sync:up`. Follow service logs with:

```powershell
npm run local:logs
```

Use `Ctrl+C` to stop following logs; it does not stop the containers.

## 8. Moving existing tournament data

Copying the repository and `.env` creates the same configuration, but not the existing database. To move tournament data, create a PostgreSQL backup on the old PC and restore it on the new one using the commands in [Local Platform Operations](LocalOperations.md#backup-and-restore).

The administrator seed runs only when the account does not already exist. After restoring an existing database, changing `INITIAL_ADMIN_PASSWORD` does not change that account's stored password.

Do not use `npm run local:reset` when data must be retained. That command deletes the local PostgreSQL and Redis volumes.

## Troubleshooting checklist

- Confirm Docker Desktop is running before invoking Compose commands.
- Confirm ports `80`, `3000`, `3003`, `3004`, `5432`, and `6379` are free, plus TCP `1337` and UDP `53000` when using the bridge.
- Run `npm run local:status` and inspect unhealthy services with `docker compose logs <service>`.
- Keep `PUBLIC_API_URL=/api/` and `PUBLIC_REALTIME_URL=/realtime/` for the single-gateway setup.
- Do not add temporary Cloudflare hostnames to `vite.config.ts`; tunnel URL changes are handled by the same-origin gateway.
