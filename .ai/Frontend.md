# Frontend Architecture and Coding Rules

## Technologies

- Node.js 22
- TypeScript
- React 18
- Vite 5
- Tailwind CSS 3
- TanStack Query

## Location

The frontend is located in `apps/frontend` and is an npm workspace. It communicates with the backend through HTTP APIs and WebSocket gateways.

Vite loads environment files from the repository root so local and container configuration remain centralized.

## Realtime Recovery

- Treat HTTP snapshots as authoritative view state.
- Treat WebSocket messages as incremental updates.
- Reconnect automatically after transport interruption.
- Reload the relevant snapshot after reconnecting or detecting a sequence gap.
- Do not require replay of replaceable high-frequency live events.

Additional frontend architectural and coding rules have not been defined yet.
