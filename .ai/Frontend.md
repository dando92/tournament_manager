# Frontend Architecture and Coding Rules

## Technologies

- Node.js 22
- TypeScript
- React 18
- Vite 5
- Tailwind CSS 3
- TanStack Query

## Location

The frontend is located in `apps/frontend` and is an npm workspace. It communicates with the API through HTTP and with `apps/realtime` through browser WebSockets.

Vite loads build-time development defaults from the repository root. Container deployments inject public endpoints and authentication mode through `/runtime-config.js` at startup so one immutable image works in every environment.

## Realtime Recovery

- Treat HTTP snapshots as authoritative view state.
- Treat WebSocket messages as incremental updates.
- Reconnect automatically after transport interruption.
- Reload the relevant snapshot after reconnecting or detecting a sequence gap.
- Do not require replay of replaceable high-frequency live events.
- Configure the browser WebSocket and realtime snapshot origin independently with `PUBLIC_REALTIME_URL`; `PUBLIC_API_URL` remains the authoritative application API. The `VITE_*` values are development fallbacks only.
- Keep the legacy path-specific message handlers during the migration, but route them through the shared reconnecting and sequence-aware client.

## Tournament Lifecycle

- Tournament lifecycle state comes from the authoritative HTTP response.
- Closed tournaments expose read views but suppress mutation controls. Configuration remains available to authorized staff so the tournament can be reopened.
- Closing requires an explicit confirmation that states the configured retention period, read-only behavior, lobby disconnection, and permanent transport-data deletion.
- Reopening restores mutation controls but does not imply that previously purged transport history can be reconstructed.

Additional frontend architectural and coding rules remain intentionally minimal.
