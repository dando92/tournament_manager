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

Vite loads build-time development defaults from the repository root. Container deployments inject public endpoints through `/runtime-config.js` at startup so one immutable image works in every environment.

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

## Navigation

The tournament tree in the sidebar is the application's only navigation. Keep it
that way: a second control that reaches the same destination is what made the
previous layout hard to follow.

- Every node the tree can select is an address. A branch (division, phase, pool)
  opens the same flat match list at a different depth; the open match is a
  `?match=` search parameter, because it is a sub-state of the list rather than
  another destination.
- `TournamentUpdatesProvider` and `TournamentTreeProvider` are mounted in
  `MainLayout`, above both the sidebar and the page outlet. The tree draws state
  derived from the same data the pages show, so it has to sit beside them, not
  inside them.
- Tournament structure — divisions, phases, pools — belongs to
  `TournamentTreeProvider` alone, together with every operation that changes it.
  Pages read it from there rather than fetching it again.
- Creation, renaming and deletion of structure act on a node, so they live in
  that node's context menu. A page header carries only what applies to the page
  it heads.
- Destinations a viewer cannot reach are omitted from the tree, not disabled.
- Tree expansion, recent tournaments and pinned tournaments persist in
  localStorage. Sidebar width does not: it is a momentary adjustment, not a
  setting.

## Song Import

The browser owns the folder a person picked, so the browser reads it. The
importer opens a directory picker, walks the handles it is given, parses the
simfiles it finds, and sends one payload of charts to `POST /songs/import`;
the API validates that payload and writes it in one transaction.

- Never upload a `Songs` folder to reproduce the parsing on a server.
- Keep the parsing pure. `songImport/stepmaniaParser.ts` takes text and gives
  values, `songImport/scan.ts` takes directory handles, and both are testable
  without a browser.
- The discovery rules come from `itgmania-songs-to-json.mjs` and are not to be
  reinvented: the picked folder is one pack when any direct child holds a
  simfile, folders starting with `.` are ignored, `.ssc` wins over `.sm`,
  `dance-single` is the only step type imported, and `highest` is the highest
  meter.
- A folder is read once. Choosing between every difficulty and the highest one
  filters the parsed result in memory; it does not go back to the disk.
- The difficulty slot is read from the simfile, never derived from the meter.
  A slot the application does not know is skipped and reported.
- The `chart-*` colours are the cabinet's, like `judgment`. They are data:
  never realign one to the semantic palette.

## Cascading Path Picker

A hierarchical destination is chosen as one path, not as one dropdown per level.
`shared/components/ui/CascadingPathPicker.tsx` draws it and
`shared/components/ui/cascadingPath.ts` holds the rules, which are pure and
depth-agnostic so they can be read as a table of paths in
`tests/unit/cascading-path.test.ts`.

- The depth is fixed. Changing a level never removes the levels below it: they
  become empty slots, so the layout does not move while a path is completed.
- A level offers what its ancestors allow, and a level whose ancestors are not
  settled cannot be used.
- Choosing a level clears everything below it. A value that is not among the
  options of its level is not a selection and is dropped by the same pass, so no
  caller has to remember to clear one.
- A level offering exactly one option settles itself, and the level below it may
  then settle in turn. A person is never asked for a choice they do not have.
- The path is owned by the form, not by the picker: the picker reports the
  settled path and the form derives completeness from it. Never keep a second
  piece of state saying whether the path is complete — `isCompleteMatchPath` is
  a type guard over the value itself.
- The options panel is positioned inside the picker rather than portalled. It
  has to escape the horizontal scroller, not the page, and a portalled panel
  inside a dialog reads as a click outside that dialog.

Additional frontend architectural and coding rules remain intentionally minimal.
